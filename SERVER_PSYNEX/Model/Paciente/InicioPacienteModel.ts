// =====================================================================
// cambio: ARCHIVO NUEVO — datos de la pantalla de Inicio del paciente:
// su nombre, la próxima cita, citas por pagar, cómo se sintió hoy,
// cuestionarios pendientes y las especialidades para buscar psicólogo.
// =====================================================================
import { conexion } from "../conexion.ts";
import { hoyColombia, RegistroEmocionalModel } from "./RegistroEmocionalModel.ts";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const InicioPacienteModel = {
  async resumen(usuarioId: string) {
    const [u] = await conexion.query(
      `SELECT u.NombreCompleto, pp.PerfiluId
       FROM usuarios u LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       WHERE u.UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (!u) return null;
    const perfilId = texto(u.PerfiluId);

    // Próxima cita (como titular o acompañante) que todavía no termina
    const [cita] = perfilId
      ? await conexion.query(
        `SELECT c.CitaId, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora, c.Modalidad, c.Estado,
                us.NombreCompleto AS Psicologo
         FROM citas c
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         JOIN usuarios us ON us.UsuarioId = ps.UsuarioId
         WHERE (c.PacienteId = ? OR EXISTS (SELECT 1 FROM participantescita pc WHERE pc.CitaId = c.CitaId AND pc.PacienteId = ?))
           AND c.Estado IN ('Pendiente', 'Confirmada')
           AND DATE_ADD(c.FechaHora, INTERVAL c.DuracionMinutos MINUTE) > NOW()
         ORDER BY c.FechaHora ASC LIMIT 1`,
        [perfilId, perfilId],
      ) as Fila[]
      : [];

    // Citas aceptadas que el paciente (titular) todavía no ha pagado
    const [porPagar] = perfilId
      ? await conexion.query(
        `SELECT COUNT(*) AS n FROM citas c
         WHERE c.PacienteId = ? AND c.Estado = 'Confirmada'
           AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.CitaId = c.CitaId AND p.EstadoPago IN ('Completado', 'Pendiente'))`,
        [perfilId],
      ) as Fila[]
      : [];

    // Cuestionarios que le asignaron y no ha respondido
    const [pendientes] = await conexion.query(
      `SELECT COUNT(*) AS n FROM cuestionarioasignado a
       WHERE a.Estado = 'Pendiente' AND (a.PacienteId = ? OR a.PacienteId = ?)`,
      [usuarioId, perfilId || usuarioId],
    ) as Fila[];

    // Registro emocional de hoy (si la tabla aún no tiene las columnas nuevas, no se rompe Inicio)
    let registroHoy: number | null = null;
    let diasRegistrados = 0;
    try {
      registroHoy = (await RegistroEmocionalModel.deHoy(usuarioId))?.estado ?? null;
      const [s] = await conexion.query(
        `SELECT COUNT(*) AS n FROM registroemocional
         WHERE PacienteId = ? AND Fecha > DATE_SUB(?, INTERVAL 7 DAY)`,
        [usuarioId, hoyColombia()],
      ) as Fila[];
      diasRegistrados = Number(s?.n ?? 0);
    } catch (e) {
      console.error("Registro emocional (¿falta ejecutar registro_emocional.sql?):", (e as Error).message);
    }

    // Especialidades que tienen al menos un psicólogo verificado
    const especialidades = await conexion.query(
      `SELECT e.NombreEspecialidad AS Nombre, COUNT(DISTINCT ps.PerfilId) AS Psicologos
       FROM especialidades e
       JOIN psicologoespecialidad pe ON pe.EspecialidadId = e.EspecialidadId
       JOIN perfilpsicologo ps ON ps.PerfilId = pe.PerfilId AND ps.EstaVerificado = 1
       WHERE e.EstaActiva = 1
       GROUP BY e.EspecialidadId, e.NombreEspecialidad
       ORDER BY Psicologos DESC, e.NombreEspecialidad ASC
       LIMIT 10`,
    ) as Fila[];

    return {
      nombre: texto(u.NombreCompleto),
      proximaCita: cita
        ? {
          id: texto(cita.CitaId),
          fechaHora: texto(cita.FechaHora),
          modalidad: texto(cita.Modalidad),
          estado: texto(cita.Estado),
          psicologo: texto(cita.Psicologo),
        }
        : null,
      citasPorPagar: Number(porPagar?.n ?? 0),
      cuestionariosPendientes: Number(pendientes?.n ?? 0),
      registroHoy,
      diasRegistrados,
      especialidades: especialidades.map((f) => ({ nombre: texto(f.Nombre), psicologos: Number(f.Psicologos ?? 0) })),
    };
  },
};
