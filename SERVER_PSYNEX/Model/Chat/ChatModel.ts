import { conexion } from "../conexion.ts";
import type { ListarMensajesQuery } from "../../Validators/Chat/ChatValidator.ts";

type Fila = Record<string, unknown>;

// =====================================================================
// Chat entre psicólogo y paciente.
//
// Reglas:
//  - Solo existe conversación entre un psicólogo y un paciente que tengan
//    (o hayan tenido) una cita que no esté cancelada.
//  - En conversaciones: Usuario1Id = psicólogo y Usuario2Id = paciente
//    (los dos son UsuarioId de la tabla usuarios).
//  - Solo el psicólogo puede cerrar o reabrir la conversación.
// =====================================================================

export interface MensajeChat {
  id: string;
  conversacionId: string;
  emisorId: string;
  tipo: "texto" | "imagen" | "documento";
  texto: string;
  archivo: { nombre: string; mime: string; bytes: number } | null;
  leido: boolean;
  fecha: unknown;
}

const aMensaje = (f: Fila): MensajeChat => ({
  id: String(f.MensajeId),
  conversacionId: String(f.ConversacionId),
  emisorId: String(f.EmisorId),
  tipo: String(f.Tipo ?? "texto") as MensajeChat["tipo"],
  texto: String(f.Contenido ?? ""),
  archivo: f.ArchivoNombre
    ? { nombre: String(f.ArchivoNombre), mime: String(f.ArchivoMime ?? ""), bytes: Number(f.ArchivoBytes ?? 0) }
    : null,
  leido: Number(f.EstaLeido) === 1,
  fecha: f.FechaEnvio,
});

const COLUMNAS_MENSAJE = `MensajeId, ConversacionId, EmisorId, Contenido, Tipo,
  ArchivoNombre, ArchivoMime, ArchivoBytes, EstaLeido, FechaEnvio`;

export const ChatModel = {
  // Crea las conversaciones que falten: una por cada psicólogo–paciente
  // con citas no canceladas. Así la lista siempre está completa.
  async asegurarConversaciones(usuarioId: string, rol: string) {
    let parejas: Fila[] = [];
    if (rol === "Psicologo") {
      parejas = await conexion.query(
        `SELECT ps.UsuarioId AS PsicologoUsuario, pp.UsuarioId AS PacienteUsuario,
                SUBSTRING_INDEX(GROUP_CONCAT(c.CitaId ORDER BY c.FechaHora DESC), ',', 1) AS CitaId
         FROM citas c
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
         JOIN usuarios up ON up.UsuarioId = pp.UsuarioId AND up.EstadoActivo = 1
         WHERE ps.UsuarioId = ? AND c.Estado <> 'Cancelada'
         GROUP BY ps.UsuarioId, pp.UsuarioId`,
        [usuarioId],
      ) as Fila[];
    } else if (rol === "Paciente") {
      parejas = await conexion.query(
        `SELECT ps.UsuarioId AS PsicologoUsuario, pp.UsuarioId AS PacienteUsuario,
                SUBSTRING_INDEX(GROUP_CONCAT(c.CitaId ORDER BY c.FechaHora DESC), ',', 1) AS CitaId
         FROM citas c
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
         JOIN usuarios us ON us.UsuarioId = ps.UsuarioId AND us.EstadoActivo = 1
         WHERE pp.UsuarioId = ? AND c.Estado <> 'Cancelada'
         GROUP BY ps.UsuarioId, pp.UsuarioId`,
        [usuarioId],
      ) as Fila[];
    }

    for (const p of parejas) {
      // Si una pareja falla (datos de prueba incompletos), se salta y se sigue con las demás
      try {
        const existe = await conexion.query(
          `SELECT 1 FROM conversaciones
         WHERE (Usuario1Id = ? AND Usuario2Id = ?) OR (Usuario1Id = ? AND Usuario2Id = ?) LIMIT 1`,
          [p.PsicologoUsuario, p.PacienteUsuario, p.PacienteUsuario, p.PsicologoUsuario],
        );
        if (!existe.length) {
          await conexion.execute(
            `INSERT INTO conversaciones (ConversacionId, Usuario1Id, Usuario2Id, CitaId, FechaInicio, Cerrada)
           VALUES (?, ?, ?, ?, NOW(), 0)`,
            [crypto.randomUUID(), p.PsicologoUsuario, p.PacienteUsuario, p.CitaId ?? null],
          );
        }
      } catch (e) {
        console.error("Chat: no se pudo crear la conversación", p.PsicologoUsuario, p.PacienteUsuario, e);
      }
    }
  },

  // Lista de la columna izquierda
  async listarConversaciones(usuarioId: string) {
    const filas = await conexion.query(
      `SELECT c.ConversacionId, c.Usuario1Id, c.Cerrada,
              IF(c.Usuario1Id = ?, c.Usuario2Id, c.Usuario1Id) AS OtroId,
              u.NombreCompleto, u.Rol,
              (COALESCE(pp.Foto, ps.Foto, '') LIKE 'data:image/%') AS TieneFoto,
              (SELECT COUNT(*) FROM mensajes m
                WHERE m.ConversacionId = c.ConversacionId AND m.EmisorId <> ? AND m.EstaLeido = 0) AS NoLeidos
       FROM conversaciones c
       JOIN usuarios u ON u.UsuarioId = IF(c.Usuario1Id = ?, c.Usuario2Id, c.Usuario1Id)
       LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE (c.Usuario1Id = ? OR c.Usuario2Id = ?) AND u.EstadoActivo = 1`,
      [usuarioId, usuarioId, usuarioId, usuarioId, usuarioId],
    ) as Fila[];

    const lista = [];
    for (const f of filas) {
      const conversacionId = String(f.ConversacionId);
      const [ultimo] = await conexion.query(
        `SELECT ${COLUMNAS_MENSAJE} FROM mensajes
         WHERE ConversacionId = ? ORDER BY FechaEnvio DESC LIMIT 1`,
        [conversacionId],
      ) as Fila[];

      // Próxima cita entre los dos (para mostrarla en la cabecera)
      const psicologoUsuario = String(f.Usuario1Id);
      const pacienteUsuario = psicologoUsuario === usuarioId ? String(f.OtroId) : usuarioId;
      const [cita] = await conexion.query(
        `SELECT MIN(c.FechaHora) AS Proxima
         FROM citas c
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
         WHERE ps.UsuarioId = ? AND pp.UsuarioId = ?
           AND c.FechaHora >= NOW() AND c.Estado IN ('Pendiente', 'Confirmada')`,
        [psicologoUsuario, pacienteUsuario],
      ) as Fila[];

      lista.push({
        id: conversacionId,
        otroId: String(f.OtroId),
        nombre: String(f.NombreCompleto ?? "Usuario"),
        rol: String(f.Rol ?? ""),
        tieneFoto: Number(f.TieneFoto ?? 0) === 1,
        cerrada: Number(f.Cerrada ?? 0) === 1,
        noLeidos: Number(f.NoLeidos ?? 0),
        proximaCita: cita?.Proxima ?? null,
        ultimoMensaje: ultimo ? aMensaje(ultimo) : null,
      });
    }

    // Las conversaciones con mensajes más recientes van primero
    lista.sort((a, b) => {
      const fa = a.ultimoMensaje ? new Date(String(a.ultimoMensaje.fecha)).getTime() : 0;
      const fb = b.ultimoMensaje ? new Date(String(b.ultimoMensaje.fecha)).getTime() : 0;
      return fb - fa;
    });
    return lista;
  },

  // Devuelve la conversación si el usuario participa en ella (si no, null)
  async participante(conversacionId: string, usuarioId: string) {
    const [c] = await conexion.query(
      `SELECT ConversacionId, Usuario1Id, Usuario2Id, Cerrada FROM conversaciones
       WHERE ConversacionId = ? AND (Usuario1Id = ? OR Usuario2Id = ?) LIMIT 1`,
      [conversacionId, usuarioId, usuarioId],
    ) as Fila[];
    if (!c) return null;
    const psicologoId = String(c.Usuario1Id);
    return {
      id: String(c.ConversacionId),
      psicologoId,
      pacienteId: String(c.Usuario2Id),
      otroId: psicologoId === usuarioId ? String(c.Usuario2Id) : psicologoId,
      cerrada: Number(c.Cerrada) === 1,
    };
  },

  // Mensajes de una conversación (los 50 más recientes, o los anteriores a "antes")
  async mensajes(conversacionId: string, f: ListarMensajesQuery) {
    const params: unknown[] = [conversacionId];
    let filtro = "";
    if (f.antes) {
      filtro = "AND FechaEnvio < ?";
      params.push(new Date(f.antes));
    }
    const filas = await conexion.query(
      `SELECT ${COLUMNAS_MENSAJE} FROM mensajes
       WHERE ConversacionId = ? ${filtro}
       ORDER BY FechaEnvio DESC LIMIT ?`,
      [...params, f.limite],
    ) as Fila[];
    return filas.map(aMensaje).reverse();
  },

  async crearMensaje(d: {
    conversacionId: string;
    emisorId: string;
    tipo: MensajeChat["tipo"];
    texto: string;
    archivo?: { ruta: string; nombre: string; mime: string; bytes: number } | null;
  }): Promise<MensajeChat> {
    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO mensajes
         (MensajeId, ConversacionId, EmisorId, Contenido, Tipo,
          ArchivoRuta, ArchivoNombre, ArchivoMime, ArchivoBytes, EstaLeido, FechaEnvio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        id,
        d.conversacionId,
        d.emisorId,
        d.texto,
        d.tipo,
        d.archivo?.ruta ?? null,
        d.archivo?.nombre ?? null,
        d.archivo?.mime ?? null,
        d.archivo?.bytes ?? null,
      ],
    );
    const [fila] = await conexion.query(
      `SELECT ${COLUMNAS_MENSAJE} FROM mensajes WHERE MensajeId = ? LIMIT 1`,
      [id],
    ) as Fila[];
    return aMensaje(fila);
  },

  // Marca como leídos los mensajes que le enviaron a este usuario
  async marcarLeidos(conversacionId: string, lectorId: string): Promise<number> {
    const r = await conexion.execute(
      `UPDATE mensajes SET EstaLeido = 1
       WHERE ConversacionId = ? AND EmisorId <> ? AND EstaLeido = 0`,
      [conversacionId, lectorId],
    );
    return r.affectedRows ?? 0;
  },

  async cambiarEstado(conversacionId: string, cerrada: boolean) {
    await conexion.execute(
      `UPDATE conversaciones SET Cerrada = ?, CerradaEn = ${cerrada ? "NOW()" : "NULL"}
       WHERE ConversacionId = ?`,
      [cerrada ? 1 : 0, conversacionId],
    );
  },

  async totalNoLeidos(usuarioId: string): Promise<number> {
    const [f] = await conexion.query(
      `SELECT COUNT(*) AS n FROM mensajes m
       JOIN conversaciones c ON c.ConversacionId = m.ConversacionId
       WHERE (c.Usuario1Id = ? OR c.Usuario2Id = ?) AND m.EmisorId <> ? AND m.EstaLeido = 0`,
      [usuarioId, usuarioId, usuarioId],
    ) as Fila[];
    return Number(f?.n ?? 0);
  },

  // Archivo de un mensaje, solo si quien lo pide es parte de la conversación
  async archivo(mensajeId: string, usuarioId: string) {
    const [f] = await conexion.query(
      `SELECT m.ArchivoRuta, m.ArchivoNombre, m.ArchivoMime
       FROM mensajes m
       JOIN conversaciones c ON c.ConversacionId = m.ConversacionId
       WHERE m.MensajeId = ? AND (c.Usuario1Id = ? OR c.Usuario2Id = ?) AND m.ArchivoRuta IS NOT NULL
       LIMIT 1`,
      [mensajeId, usuarioId, usuarioId],
    ) as Fila[];
    return f
      ? { ruta: String(f.ArchivoRuta), nombre: String(f.ArchivoNombre ?? "archivo"), mime: String(f.ArchivoMime ?? "") }
      : null;
  },

  // Foto de la otra persona: solo si comparten una conversación
  async fotoDe(usuarioId: string, quienPide: string) {
    const [f] = await conexion.query(
      `SELECT COALESCE(pp.Foto, ps.Foto) AS Foto
       FROM usuarios u
       LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE u.UsuarioId = ?
         AND (u.UsuarioId = ? OR EXISTS (
               SELECT 1 FROM conversaciones c
               WHERE (c.Usuario1Id = u.UsuarioId AND c.Usuario2Id = ?)
                  OR (c.Usuario2Id = u.UsuarioId AND c.Usuario1Id = ?)))
       LIMIT 1`,
      [usuarioId, quienPide, quienPide, quienPide],
    ) as Fila[];
    return f?.Foto ?? null;
  },

  // Con quiénes conversa un usuario (para avisarles si entra o sale de línea)
  async contactos(usuarioId: string): Promise<string[]> {
    const filas = await conexion.query(
      `SELECT IF(Usuario1Id = ?, Usuario2Id, Usuario1Id) AS OtroId
       FROM conversaciones WHERE Usuario1Id = ? OR Usuario2Id = ?`,
      [usuarioId, usuarioId, usuarioId],
    ) as Fila[];
    return filas.map((f) => String(f.OtroId));
  },

  // Aviso en la campana cuando la otra persona no tiene el chat abierto.
  // Para no llenar la campana, solo se crea si no hay otro aviso sin leer
  // de mensajes de esa misma persona.
  async notificarMensaje(destinoId: string, nombreEmisor: string) {
    const titulo = "Nuevo mensaje";
    const texto = `${nombreEmisor} te envió un mensaje.`;
    const ya = await conexion.query(
      `SELECT 1 FROM notificaciones
       WHERE UsuarioId = ? AND Titulo = ? AND Mensaje = ? AND EstaLeida = 0 LIMIT 1`,
      [destinoId, titulo, texto],
    );
    if (ya.length) return;
    await conexion.execute(
      `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
       VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
      [crypto.randomUUID(), destinoId, titulo, texto],
    );
  },

  async nombreDe(usuarioId: string): Promise<string> {
    const [f] = await conexion.query(
      `SELECT NombreCompleto FROM usuarios WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    return String(f?.NombreCompleto ?? "Alguien");
  },
};
