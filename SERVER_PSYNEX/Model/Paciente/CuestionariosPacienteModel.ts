// =====================================================================
// cambio: ARCHIVO NUEVO — cuestionarios que los psicólogos le asignaron
// al paciente (solo lectura). Las respuestas se guardan con la ruta que
// ya existía: POST /api/explorar/cuestionarios/:id/resultado, que además
// marca la asignación como "Completado".
// (En cuestionarioasignado hay asignaciones con PerfiluId y otras con
//  UsuarioId del paciente, por eso se buscan las dos.)
// =====================================================================
import { conexion } from "../conexion.ts";

type Fila = Record<string, unknown>;

const minutosAprox = (preguntas: number) => Math.max(1, Math.ceil((preguntas * 20) / 60));

export const CuestionariosPacienteModel = {
  async asignados(usuarioPacienteId: string) {
    const filas = await conexion.query(
      `SELECT a.AsignacionId, a.Estado, a.FechaAsignacion, a.FechaLimite, a.Nota,
              c.CuestionarioId, c.NombreCuestionario, c.Descripcion,
              cat.Nombre AS Categoria,
              (c.ImagenPortada IS NOT NULL) AS TieneImagen,
              (SELECT COUNT(*) FROM preguntas p WHERE p.CuestionarioId = c.CuestionarioId) AS Preguntas,
              u.UsuarioId AS PsicologoUsuarioId, u.NombreCompleto AS Psicologo,
              ps.PerfilId AS PsicologoPerfilId
       FROM cuestionarioasignado a
       JOIN cuestionarios c ON c.CuestionarioId = a.CuestionarioId
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       LEFT JOIN usuarios u ON u.UsuarioId = a.PsicologoId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = a.PsicologoId
       WHERE a.PacienteId = ?
          OR a.PacienteId = (SELECT pp.PerfiluId FROM perfilpaciente pp WHERE pp.UsuarioId = ? LIMIT 1)
       ORDER BY (a.Estado = 'Pendiente') DESC, a.FechaAsignacion DESC`,
      [usuarioPacienteId, usuarioPacienteId],
    ) as Fila[];

    return filas.map((f) => ({
      id: String(f.AsignacionId),
      estado: String(f.Estado ?? "Pendiente"),
      fechaAsignacion: f.FechaAsignacion,
      fechaLimite: f.FechaLimite ?? null,
      nota: String(f.Nota ?? ""),
      cuestionario: {
        id: String(f.CuestionarioId),
        sigla: String(f.NombreCuestionario ?? ""),
        descripcion: String(f.Descripcion ?? ""),
        categoria: String(f.Categoria ?? "General"),
        preguntas: Number(f.Preguntas ?? 0),
        minutos: minutosAprox(Number(f.Preguntas ?? 0)),
        tieneImagen: Number(f.TieneImagen ?? 0) === 1,
      },
      psicologo: {
        usuarioId: f.PsicologoUsuarioId ? String(f.PsicologoUsuarioId) : null,
        perfilId: f.PsicologoPerfilId ? String(f.PsicologoPerfilId) : null,
        nombre: String(f.Psicologo ?? "Tu psicólogo"),
      },
    }));
  },
};

// =====================================================================
// cambio: HISTORIAL de resultados del paciente (solo los visibles para él).
// "asignadoPor" dice qué psicólogo se lo asignó (si fue asignado); si es
// null, lo respondió por su cuenta (por ejemplo desde Para ti).
// =====================================================================
const SELECT_RESULTADO = `
  SELECT r.ResultadoId, r.CuestionarioId, r.PuntajeTotal, r.Interpretacion, r.FechaRespuesta,
         c.NombreCuestionario, c.Descripcion, cat.Nombre AS Categoria,
         (c.ImagenPortada IS NOT NULL) AS TieneImagen,
         (SELECT u.NombreCompleto
            FROM cuestionarioasignado a
            LEFT JOIN usuarios u ON u.UsuarioId = a.PsicologoId
           WHERE a.CuestionarioId = r.CuestionarioId
             AND a.PacienteId IN (r.PacienteId, ?)
             AND a.FechaAsignacion <= r.FechaRespuesta
           ORDER BY a.FechaAsignacion DESC LIMIT 1) AS AsignadoPor
  FROM resultadocuestionario r
  JOIN cuestionarios c ON c.CuestionarioId = r.CuestionarioId
  LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
  WHERE r.VisiblePaciente = 1
    AND r.PacienteId = (SELECT pp.PerfiluId FROM perfilpaciente pp WHERE pp.UsuarioId = ? LIMIT 1)`;

// Puntaje máximo de cada cuestionario (suma del valor más alto de cada pregunta)
async function maximos(ids: string[]) {
  const mapa = new Map<string, number>();
  if (!ids.length) return mapa;
  const filas = await conexion.query(
    `SELECT t.CuestionarioId, SUM(t.Maximo) AS Maximo
     FROM (SELECT p.CuestionarioId, p.PreguntapId, MAX(o.Valor) AS Maximo
           FROM preguntas p JOIN opcionesrespuesta o ON o.PreguntapId = p.PreguntapId
           WHERE p.CuestionarioId IN (${ids.map(() => "?").join(", ")})
           GROUP BY p.CuestionarioId, p.PreguntapId) t
     GROUP BY t.CuestionarioId`,
    ids,
  ) as Fila[];
  filas.forEach((f) => mapa.set(String(f.CuestionarioId), Number(f.Maximo ?? 0)));
  return mapa;
}

const armarResultado = (f: Fila, maximo: number) => ({
  id: String(f.ResultadoId),
  fecha: f.FechaRespuesta,
  puntaje: Number(f.PuntajeTotal ?? 0),
  maximo,
  nivel: String(f.Interpretacion ?? ""),
  asignadoPor: f.AsignadoPor ? String(f.AsignadoPor) : null,
  cuestionario: {
    id: String(f.CuestionarioId),
    sigla: String(f.NombreCuestionario ?? ""),
    descripcion: String(f.Descripcion ?? ""),
    categoria: String(f.Categoria ?? "General"),
    tieneImagen: Number(f.TieneImagen ?? 0) === 1,
  },
});

export const ResultadosPacienteModel = {
  async listar(usuarioPacienteId: string) {
    const filas = await conexion.query(
      `${SELECT_RESULTADO} ORDER BY r.FechaRespuesta DESC`,
      [usuarioPacienteId, usuarioPacienteId],
    ) as Fila[];
    const max = await maximos([...new Set(filas.map((f) => String(f.CuestionarioId)))]);
    return filas.map((f) => armarResultado(f, max.get(String(f.CuestionarioId)) ?? 0));
  },

  // Un resultado del paciente con sus respuestas y el mensaje de apoyo
  async detalle(usuarioPacienteId: string, resultadoId: string) {
    const [f] = await conexion.query(
      `${SELECT_RESULTADO} AND r.ResultadoId = ? LIMIT 1`,
      [usuarioPacienteId, usuarioPacienteId, resultadoId],
    ) as Fila[];
    if (!f) return null;

    const max = await maximos([String(f.CuestionarioId)]);
    const respuestas = (await conexion.query(
      `SELECT p.Numero, p.TextoPregunta, o.Texto AS Respuesta, d.Valor
       FROM detallerespuestas d
       JOIN preguntas p ON p.PreguntapId = d.PreguntapId
       LEFT JOIN opcionesrespuesta o ON o.OpcionId = d.OpcionId
       WHERE d.ResultadoId = ?
       ORDER BY p.Numero`,
      [resultadoId],
    ) as Fila[]).map((r) => ({
      numero: Number(r.Numero ?? 0),
      pregunta: String(r.TextoPregunta ?? ""),
      respuesta: String(r.Respuesta ?? ""),
    }));

    const [apoyo] = await conexion.query(
      `SELECT Texto FROM mensajesapoyo
       WHERE CuestionarioId = ? AND NivelRiesgo = ? AND EstadoActivo = 1 LIMIT 1`,
      [f.CuestionarioId, f.Interpretacion],
    ) as Fila[];

    return {
      ...armarResultado(f, max.get(String(f.CuestionarioId)) ?? 0),
      mensajeApoyo: apoyo ? String(apoyo.Texto) : null,
      respuestas,
    };
  },
};
