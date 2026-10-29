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
//
// Chat entre empresa y psicólogo (postulados a sus ofertas):
//  - Solo la empresa la puede iniciar, y solo con psicólogos que se
//    postularon a alguna de sus ofertas.
//  - Ahí Usuario1Id = empresa y Usuario2Id = psicólogo, así que quien
//    puede cerrarla es la empresa (siempre es "quien la inició").
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
              COALESCE(pe.NombreEmpresa, u.NombreCompleto) AS NombreCompleto, u.Rol,
              -- cambio: la foto se toma según el ROL de la otra persona (antes con COALESCE,
              -- un psicólogo que también tenía fila en perfilpaciente salía con "sin-foto.jpg")
              (COALESCE(CASE u.Rol WHEN 'Psicologo' THEN ps.Foto WHEN 'Empresa' THEN pe.Logo ELSE pp.Foto END, '') LIKE 'data:image/%') AS TieneFoto,
              CRC32(CASE u.Rol WHEN 'Psicologo' THEN ps.Foto WHEN 'Empresa' THEN pe.Logo ELSE pp.Foto END) AS FotoVersion, -- cambio: versión de la foto
              (SELECT COUNT(*) FROM mensajes m
                WHERE m.ConversacionId = c.ConversacionId AND m.EmisorId <> ? AND m.EstaLeido = 0) AS NoLeidos
       FROM conversaciones c
       JOIN usuarios u ON u.UsuarioId = IF(c.Usuario1Id = ?, c.Usuario2Id, c.Usuario1Id)
       LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       LEFT JOIN perfilempresa pe ON pe.UsuarioId = u.UsuarioId
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

      // Chat con empresa: a qué oferta se postuló el psicólogo (la más reciente)
      // (en esas conversaciones Usuario1Id es la empresa y el otro es el psicólogo)
      let detalle: string | null = null;
      const iniciador = String(f.Usuario1Id);
      if (await this.esEmpresa(iniciador)) {
        const psicologo = iniciador === usuarioId ? String(f.OtroId) : usuarioId;
        detalle = (await this.ofertaEntre(iniciador, psicologo)) ?? "Oferta laboral";
      }

      lista.push({
        id: conversacionId,
        otroId: String(f.OtroId),
        nombre: String(f.NombreCompleto ?? "Usuario"),
        rol: String(f.Rol ?? ""),
        tieneFoto: Number(f.TieneFoto ?? 0) === 1,
        fotoVersion: String(f.FotoVersion ?? ""),
        cerrada: Number(f.Cerrada ?? 0) === 1,
        noLeidos: Number(f.NoLeidos ?? 0),
        proximaCita: detalle ? null : cita?.Proxima ?? null,
        detalle,
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
      `SELECT CASE u.Rol WHEN 'Psicologo' THEN ps.Foto WHEN 'Empresa' THEN pe.Logo ELSE pp.Foto END AS Foto -- cambio: foto según el rol
       FROM usuarios u
       LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       LEFT JOIN perfilempresa pe ON pe.UsuarioId = u.UsuarioId
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
      `SELECT COALESCE(pe.NombreEmpresa, u.NombreCompleto) AS NombreCompleto
       FROM usuarios u LEFT JOIN perfilempresa pe ON pe.UsuarioId = u.UsuarioId
       WHERE u.UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    return String(f?.NombreCompleto ?? "Alguien");
  },

  // ----------------------- Chat empresa – postulados -----------------------

  async esEmpresa(usuarioId: string): Promise<boolean> {
    const [f] = await conexion.query(
      `SELECT 1 AS ok FROM perfilempresa WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    return Boolean(f);
  },

  // Título de la oferta más reciente a la que el psicólogo se postuló con esa empresa
  async ofertaEntre(empresaUsuarioId: string, psicologoUsuarioId: string): Promise<string | null> {
    const [f] = await conexion.query(
      `SELECT o.Titulo
       FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       WHERE pe.UsuarioId = ? AND po.UsuarioId = ?
       ORDER BY po.FechaPostulacion DESC LIMIT 1`,
      [empresaUsuarioId, psicologoUsuarioId],
    ) as Fila[];
    return f?.Titulo ? String(f.Titulo) : null;
  },

  // Psicólogos que se postularon a las ofertas de la empresa (uno por persona,
  // con las ofertas a las que se postuló y la conversación si ya existe)
  async postuladosDeEmpresa(empresaUsuarioId: string) {
    const filas = await conexion.query(
      `SELECT po.UsuarioId, u.NombreCompleto, po.Estado, po.FechaPostulacion, o.Titulo,
              (ps.Foto IS NOT NULL AND ps.Foto LIKE 'data:image/%') AS TieneFoto,
              CRC32(ps.Foto) AS FotoVersion,
              (SELECT c.ConversacionId FROM conversaciones c
                WHERE (c.Usuario1Id = pe.UsuarioId AND c.Usuario2Id = po.UsuarioId)
                   OR (c.Usuario1Id = po.UsuarioId AND c.Usuario2Id = pe.UsuarioId)
                LIMIT 1) AS ConversacionId
       FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       JOIN usuarios u ON u.UsuarioId = po.UsuarioId AND u.EstadoActivo = 1
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE pe.UsuarioId = ?
       ORDER BY po.FechaPostulacion DESC`,
      [empresaUsuarioId],
    ) as Fila[];

    const porPersona = new Map<string, {
      usuarioId: string; nombre: string; tieneFoto: boolean; fotoVersion: string; conversacionId: string | null;
      ultimaPostulacion: unknown; ofertas: { titulo: string; estado: string }[];
    }>();
    for (const f of filas) {
      const id = String(f.UsuarioId);
      if (!porPersona.has(id)) {
        porPersona.set(id, {
          usuarioId: id,
          nombre: String(f.NombreCompleto ?? "Psicólogo"),
          tieneFoto: Number(f.TieneFoto ?? 0) === 1,
          fotoVersion: String(f.FotoVersion ?? ""),
          conversacionId: f.ConversacionId ? String(f.ConversacionId) : null,
          ultimaPostulacion: f.FechaPostulacion,
          ofertas: [],
        });
      }
      porPersona.get(id)!.ofertas.push({ titulo: String(f.Titulo), estado: String(f.Estado) });
    }
    return [...porPersona.values()];
  },

  // La empresa le escribe a un postulado: devuelve la conversación (la crea si
  // no existe). null si ese psicólogo no se postuló a ninguna oferta suya.
  async conversacionConPostulado(empresaUsuarioId: string, psicologoUsuarioId: string) {
    const [postulado] = await conexion.query(
      `SELECT 1 AS ok FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       JOIN usuarios u ON u.UsuarioId = po.UsuarioId AND u.EstadoActivo = 1
       WHERE pe.UsuarioId = ? AND po.UsuarioId = ? LIMIT 1`,
      [empresaUsuarioId, psicologoUsuarioId],
    ) as Fila[];
    if (!postulado) return null;

    const [existe] = await conexion.query(
      `SELECT ConversacionId FROM conversaciones
       WHERE (Usuario1Id = ? AND Usuario2Id = ?) OR (Usuario1Id = ? AND Usuario2Id = ?) LIMIT 1`,
      [empresaUsuarioId, psicologoUsuarioId, psicologoUsuarioId, empresaUsuarioId],
    ) as Fila[];
    if (existe) return String(existe.ConversacionId);

    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO conversaciones (ConversacionId, Usuario1Id, Usuario2Id, CitaId, FechaInicio, Cerrada)
       VALUES (?, ?, ?, NULL, NOW(), 0)`,
      [id, empresaUsuarioId, psicologoUsuarioId],
    );
    return id;
  },
};
