import { conexion } from "../conexion.ts";
import type { ResponderCuestionarioInput } from "../../Validators/Explorar/ExplorarValidator.ts";

type Fila = Record<string, unknown>;

// Los mismos niveles que ya existen en resultadocuestionario.Interpretacion
export type Nivel = "Sin riesgo" | "Leve" | "Moderado" | "Critico";

// Nivel orientativo según el porcentaje del puntaje máximo.
// OJO: es una regla general. Cada test clínico (PHQ-9, GAD-7...) tiene sus
// propios puntos de corte; cuando se guarden en la base, se usan esos.
export function nivelPorPorcentaje(puntaje: number, maximo: number): Nivel {
  const p = maximo > 0 ? puntaje / maximo : 0;
  if (p < 0.25) return "Sin riesgo";
  if (p < 0.5) return "Leve";
  if (p < 0.75) return "Moderado";
  return "Critico";
}

// Minutos aproximados para responder (unos 20 segundos por pregunta)
const minutosAprox = (preguntas: number) => Math.max(1, Math.ceil((preguntas * 20) / 60));

export const CuestionariosExplorarModel = {

  async listar(categoriaId?: string) {
    const params: string[] = [];
    let filtro = "";
    if (categoriaId) {
      filtro = "AND c.CategoriaId = ?";
      params.push(categoriaId);
    }
    const filas = await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario, c.Descripcion, c.PuntajeMaximo,
              (c.ImagenPortada IS NOT NULL) AS TieneImagen,
              cat.CategoriaId, cat.Nombre AS Categoria,
              (SELECT COUNT(*) FROM preguntas p WHERE p.CuestionarioId = c.CuestionarioId) AS Preguntas
       FROM cuestionarios c
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       WHERE c.EstadoActivo = 1 ${filtro}
       HAVING Preguntas > 0
       ORDER BY cat.Nombre, c.NombreCuestionario`,
      params,
    ) as Fila[];
    return filas.map((f) => ({
      id: String(f.CuestionarioId),
      sigla: String(f.NombreCuestionario),
      descripcion: String(f.Descripcion ?? ""),
      categoriaId: f.CategoriaId ? String(f.CategoriaId) : null,
      categoria: String(f.Categoria ?? "General"),
      preguntas: Number(f.Preguntas),
      minutos: minutosAprox(Number(f.Preguntas)),
      // La imagen se pide aparte: /api/explorar/cuestionarios/:id/imagen
      tieneImagen: Number(f.TieneImagen ?? 0) === 1,
    }));
  },

  async categorias() {
    return await conexion.query(
      `SELECT cat.CategoriaId, cat.Nombre, cat.Descripcion,
              COUNT(c.CuestionarioId) AS Cantidad
       FROM categoriasclinicas cat
       JOIN cuestionarios c ON c.CategoriaId = cat.CategoriaId AND c.EstadoActivo = 1
       GROUP BY cat.CategoriaId, cat.Nombre, cat.Descripcion
       ORDER BY cat.Nombre`,
    );
  },

  // Cuestionario con sus preguntas y opciones (para responderlo)
  async detalle(cuestionarioId: string) {
    const [c] = await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario, c.Descripcion, cat.Nombre AS Categoria,
              (c.ImagenPortada IS NOT NULL) AS TieneImagen
       FROM cuestionarios c
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       WHERE c.CuestionarioId = ? AND c.EstadoActivo = 1 LIMIT 1`,
      [cuestionarioId],
    ) as Fila[];
    if (!c) return null;

    const filas = await conexion.query(
      `SELECT p.PreguntapId, p.Numero, p.TextoPregunta,
              o.OpcionId, o.Texto, o.Valor
       FROM preguntas p
       JOIN opcionesrespuesta o ON o.PreguntapId = p.PreguntapId
       WHERE p.CuestionarioId = ?
       ORDER BY p.Numero, o.Valor`,
      [cuestionarioId],
    ) as Fila[];

    const preguntas = new Map<string, { id: string; numero: number; texto: string; opciones: { id: string; texto: string }[] }>();
    for (const f of filas) {
      const id = String(f.PreguntapId);
      if (!preguntas.has(id)) {
        preguntas.set(id, { id, numero: Number(f.Numero), texto: String(f.TextoPregunta), opciones: [] });
      }
      // El valor (puntaje) de cada opción NO se envía: se calcula en el servidor
      preguntas.get(id)!.opciones.push({ id: String(f.OpcionId), texto: String(f.Texto) });
    }

    return {
      id: String(c.CuestionarioId),
      sigla: String(c.NombreCuestionario),
      descripcion: String(c.Descripcion ?? ""),
      categoria: String(c.Categoria ?? "General"),
      tieneImagen: Number(c.TieneImagen ?? 0) === 1,
      minutos: minutosAprox(preguntas.size),
      preguntas: [...preguntas.values()],
    };
  },

  // Ruta del archivo de la imagen de portada (también de los inactivos,
  // para que el admin la vea en su panel; una imagen no es dato sensible)
  async rutaImagen(cuestionarioId: string): Promise<string | null> {
    const [fila] = await conexion.query(
      `SELECT ImagenPortada FROM cuestionarios
       WHERE CuestionarioId = ? LIMIT 1`,
      [cuestionarioId],
    ) as Fila[];
    return fila?.ImagenPortada ? String(fila.ImagenPortada) : null;
  },

  // Calcula el resultado. Si quien responde es un paciente con sesión,
  // además lo guarda (y si es crítico, alerta a su psicólogo).
  async resolver(cuestionarioId: string, d: ResponderCuestionarioInput, usuario?: { id: string; rol: string }) {
    const [c] = await conexion.query(
      `SELECT CuestionarioId, NombreCuestionario FROM cuestionarios
       WHERE CuestionarioId = ? AND EstadoActivo = 1 LIMIT 1`,
      [cuestionarioId],
    ) as Fila[];
    if (!c) return { error: "Cuestionario no encontrado", status: 404 };

    const opciones = await conexion.query(
      `SELECT p.PreguntapId, o.OpcionId, o.Valor
       FROM preguntas p JOIN opcionesrespuesta o ON o.PreguntapId = p.PreguntapId
       WHERE p.CuestionarioId = ?`,
      [cuestionarioId],
    ) as Fila[];

    // Valor de cada opción y valor máximo de cada pregunta
    const valorOpcion = new Map<string, { pregunta: string; valor: number }>();
    const maxPregunta = new Map<string, number>();
    for (const o of opciones) {
      const pregunta = String(o.PreguntapId);
      const valor = Number(o.Valor);
      valorOpcion.set(String(o.OpcionId), { pregunta, valor });
      maxPregunta.set(pregunta, Math.max(maxPregunta.get(pregunta) ?? 0, valor));
    }

    // Todas las preguntas respondidas, una sola vez, con opciones de esa pregunta
    const respondidas = new Map<string, { opcionId: string; valor: number }>();
    for (const r of d.respuestas) {
      const op = valorOpcion.get(r.opcionId);
      if (!op || op.pregunta !== r.preguntaId) return { error: "Hay una respuesta que no corresponde a la pregunta", status: 400 };
      if (respondidas.has(r.preguntaId)) return { error: "Hay preguntas respondidas dos veces", status: 400 };
      respondidas.set(r.preguntaId, { opcionId: r.opcionId, valor: op.valor });
    }
    if (respondidas.size !== maxPregunta.size) {
      return { error: "Responde todas las preguntas para ver tu resultado", status: 400 };
    }

    const puntaje = [...respondidas.values()].reduce((s, r) => s + r.valor, 0);
    const maximo = [...maxPregunta.values()].reduce((s, v) => s + v, 0);
    const nivel = nivelPorPorcentaje(puntaje, maximo);

    // Mensaje de apoyo que el admin haya configurado para ese nivel (si existe)
    const [apoyo] = await conexion.query(
      `SELECT Texto FROM mensajesapoyo
       WHERE CuestionarioId = ? AND NivelRiesgo = ? AND EstadoActivo = 1 LIMIT 1`,
      [cuestionarioId, nivel],
    ) as Fila[];

    const base = { puntaje, maximo, nivel, mensajeApoyo: apoyo ? String(apoyo.Texto) : null, guardado: false };

    // Visitante sin sesión, o con otro rol: solo se muestra, no se guarda
    if (!usuario || usuario.rol !== "Paciente") return base;

    const [paciente] = await conexion.query(
      `SELECT PerfiluId FROM perfilpaciente WHERE UsuarioId = ? LIMIT 1`,
      [usuario.id],
    ) as Fila[];
    if (!paciente) return base;
    const pacienteId = String(paciente.PerfiluId);

    const resultadoId = crypto.randomUUID();
    await conexion.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO resultadocuestionario
           (ResultadoId, PacienteId, CuestionarioId, PuntajeTotal, Interpretacion, VisiblePaciente, FechaRespuesta)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [resultadoId, pacienteId, cuestionarioId, puntaje, nivel],
      );
      for (const [preguntaId, r] of respondidas) {
        await conn.execute(
          `INSERT INTO detallerespuestas (DetalleId, ResultadoId, PreguntapId, OpcionId, Valor, CreadoEn)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), resultadoId, preguntaId, r.opcionId, r.valor],
        );
      }
      // Si su psicólogo se lo había asignado, la asignación queda completada.
      // (En la tabla hay asignaciones con PerfiluId y otras con UsuarioId.)
      await conn.execute(
        `UPDATE cuestionarioasignado SET Estado = 'Completado'
         WHERE CuestionarioId = ? AND PacienteId IN (?, ?) AND Estado = 'Pendiente'`,
        [cuestionarioId, pacienteId, usuario.id],
      );

      if (nivel === "Critico") {
        // Se alerta al psicólogo con el que tiene o tuvo la cita más reciente
        const [psi] = await conn.query(
          `SELECT c.PsicologoId, ps.UsuarioId
           FROM citas c JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
           WHERE c.PacienteId = ? AND c.Estado IN ('Confirmada', 'Completada')
           ORDER BY c.FechaHora DESC LIMIT 1`,
          [pacienteId],
        ) as Fila[];
        await conn.execute(
          `INSERT INTO alertas (AlertaId, PacienteId, PsicologoId, ResultadoId, NivelRiesgo, FueAtendida, FechaAlerta)
           VALUES (?, ?, ?, ?, 'Critico', 0, NOW())`,
          [crypto.randomUUID(), pacienteId, psi?.PsicologoId ?? null, resultadoId],
        );
        if (psi?.UsuarioId) {
          await conn.execute(
            `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
             VALUES (?, ?, 'Alerta', 'Alerta de riesgo', ?, 0, NOW())`,
            [crypto.randomUUID(), psi.UsuarioId, `Un paciente obtuvo un resultado crítico en ${c.NombreCuestionario}.`],
          );
        }
      }
    });

    return { ...base, guardado: true, resultadoId };
  },
};
