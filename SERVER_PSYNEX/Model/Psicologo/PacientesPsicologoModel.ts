import { conexion } from "../conexion.ts";
import type { ListarPacientesQuery } from "../../Validators/Psicologo/PacientesPsicologoValidator.ts";

// Estado del proceso con el psicólogo, calculado a partir de sus citas:
//  - Activa: tiene una cita próxima.
//  - En seguimiento: no tiene próxima, pero tuvo una en los últimos 30 días.
//  - Finalizada: no ha tenido citas en más de 30 días.
function estadoDelProceso(proxima: unknown, ultima: unknown): string {
  if (proxima) return "Activa";
  if (ultima && Date.now() - new Date(String(ultima)).getTime() <= 30 * 86_400_000) {
    return "En seguimiento";
  }
  return "Finalizada";
}

// Si el paciente pidió ser anónimo, no se expone su nombre ni su correo.
function nombreVisible(f: Record<string, unknown>) {
  return Number(f.EsAnonimo) === 1 ? "Paciente anónimo" : (f.NombreCompleto ?? "Paciente");
}

export const PacientesPsicologoModel = {

  // Pacientes que han tenido citas con este psicólogo (sin contar canceladas)
  async listar(perfilId: string, filtros: ListarPacientesQuery) {
    const filas = await conexion.query(
      `SELECT pp.PerfiluId AS PacienteId, pp.EsAnonimo, pp.Telefono, pp.Genero,
              u.NombreCompleto, u.Email, u.FechaNacimiento,
              COUNT(*) AS TotalCitas,
              SUM(c.Estado = 'Completada') AS Sesiones,
              MAX(CASE WHEN c.FechaHora < NOW() AND c.Estado IN ('Completada', 'Confirmada')
                       THEN c.FechaHora END) AS UltimaCita,
              MIN(CASE WHEN c.FechaHora >= NOW() AND c.Estado IN ('Pendiente', 'Confirmada')
                       THEN c.FechaHora END) AS ProximaCita,
              SUBSTRING_INDEX(GROUP_CONCAT(c.Modalidad ORDER BY c.FechaHora DESC), ',', 1) AS Modalidad,
              SUBSTRING_INDEX(GROUP_CONCAT(c.TipoCita ORDER BY c.FechaHora DESC), ',', 1) AS TipoCita
       FROM citas c
       JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE c.PsicologoId = ? AND c.Estado <> 'Cancelada'
       GROUP BY pp.PerfiluId, pp.EsAnonimo, pp.Telefono, pp.Genero,
                u.NombreCompleto, u.Email, u.FechaNacimiento
       -- MariaDB no deja usar un alias de agregado dentro de una expresión,
       -- por eso se repite el MIN(...) para mandar al final a quien no tiene próxima cita.
       ORDER BY MIN(CASE WHEN c.FechaHora >= NOW() AND c.Estado IN ('Pendiente', 'Confirmada')
                         THEN c.FechaHora END) IS NULL,
                ProximaCita, UltimaCita DESC`,
      [perfilId],
    );

    const texto = filtros.busqueda?.toLowerCase() ?? "";
    return filas
      .map((f: Record<string, unknown>) => ({
        pacienteId: f.PacienteId,
        nombre: nombreVisible(f),
        email: Number(f.EsAnonimo) === 1 ? null : (f.Email ?? null),
        telefono: Number(f.EsAnonimo) === 1 ? null : (f.Telefono || null),
        genero: f.Genero || null,
        fechaNacimiento: f.FechaNacimiento ?? null,
        anonimo: Number(f.EsAnonimo) === 1,
        totalCitas: Number(f.TotalCitas),
        sesiones: Number(f.Sesiones ?? 0),
        ultimaCita: f.UltimaCita ?? null,
        proximaCita: f.ProximaCita ?? null,
        modalidad: f.Modalidad ?? null,
        tipoCita: f.TipoCita ?? null,
        estado: estadoDelProceso(f.ProximaCita, f.UltimaCita),
      }))
      .filter((p: { nombre: unknown; estado: string }) =>
        (filtros.estado === "todos" || p.estado === filtros.estado) &&
        (!texto || String(p.nombre).toLowerCase().includes(texto))
      );
  },

  // Historial completo de UN paciente con este psicólogo
  async historial(perfilId: string, usuarioPsicologoId: string, pacienteId: string) {
    const [paciente] = await conexion.query(
      `SELECT pp.PerfiluId AS PacienteId, pp.EsAnonimo, pp.Telefono, pp.Genero, pp.Ocupacion,
              u.NombreCompleto, u.Email, u.FechaNacimiento
       FROM perfilpaciente pp
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE pp.PerfiluId = ?
       LIMIT 1`,
      [pacienteId],
    );
    if (!paciente) return null;

    const citas = await conexion.query(
      `SELECT CitaId, FechaHora, DuracionMinutos, Modalidad, TipoCita, Estado,
              RazonConsulta, LinkVideollamada, CanceladaEn
       FROM citas
       WHERE PsicologoId = ? AND PacienteId = ?
       ORDER BY FechaHora DESC`,
      [perfilId, pacienteId],
    );

    // Resultados de cuestionarios del paciente (RNF-09: el psicólogo tratante sí los ve)
    const resultados = await conexion.query(
      `SELECT r.ResultadoId, r.PuntajeTotal, r.Interpretacion, r.FechaRespuesta,
              c.CuestionarioId, c.NombreCuestionario, c.PuntajeMaximo
       FROM resultadocuestionario r
       JOIN cuestionarios c ON c.CuestionarioId = r.CuestionarioId
       WHERE r.PacienteId = ?
       ORDER BY r.FechaRespuesta DESC`,
      [pacienteId],
    );

    // Cuestionarios que este psicólogo le asignó
    const asignaciones = await conexion.query(
      `SELECT a.AsignacionId, a.Estado, a.FechaAsignacion, a.FechaLimite, a.Nota,
              c.NombreCuestionario
       FROM cuestionarioasignado a
       JOIN cuestionarios c ON c.CuestionarioId = a.CuestionarioId
       WHERE a.PsicologoId = ? AND a.PacienteId = ?
       ORDER BY a.FechaAsignacion DESC`,
      [usuarioPsicologoId, pacienteId],
    );

    const notas = await this.listarNotas(perfilId, pacienteId);

    const anonimo = Number(paciente.EsAnonimo) === 1;
    return {
      paciente: {
        pacienteId: paciente.PacienteId,
        nombre: nombreVisible(paciente),
        email: anonimo ? null : paciente.Email,
        telefono: anonimo ? null : (paciente.Telefono || null),
        genero: paciente.Genero || null,
        ocupacion: paciente.Ocupacion || null,
        fechaNacimiento: paciente.FechaNacimiento ?? null,
        anonimo,
        sesiones: citas.filter((c: { Estado: string }) => c.Estado === "Completada").length,
      },
      citas,
      resultados,
      asignaciones,
      notas,
    };
  },

  // ----------------------- Notas de sesión -----------------------

  async listarNotas(perfilId: string, pacienteId: string) {
    return await conexion.query(
      `SELECT n.NotaId, n.CitaId, n.Contenido, n.CreadoEn, n.ActualizadoEn,
              c.FechaHora AS CitaFecha
       FROM notassesion n
       LEFT JOIN citas c ON c.CitaId = n.CitaId
       WHERE n.PsicologoId = ? AND n.PacienteId = ?
       ORDER BY n.CreadoEn DESC`,
      [perfilId, pacienteId],
    );
  },

  // Devuelve el id, o null si la cita indicada no es de este psicólogo con este paciente
  async crearNota(perfilId: string, pacienteId: string, contenido: string, citaId?: string | null) {
    if (citaId) {
      const cita = await conexion.query(
        `SELECT 1 FROM citas WHERE CitaId = ? AND PsicologoId = ? AND PacienteId = ? LIMIT 1`,
        [citaId, perfilId, pacienteId],
      );
      if (!cita.length) return null;
    }
    const notaId = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO notassesion (NotaId, PsicologoId, PacienteId, CitaId, Contenido, CreadoEn)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [notaId, perfilId, pacienteId, citaId ?? null, contenido],
    );
    return notaId;
  },

  async actualizarNota(perfilId: string, notaId: string, contenido: string) {
    const r = await conexion.execute(
      `UPDATE notassesion SET Contenido = ?, ActualizadoEn = NOW()
       WHERE NotaId = ? AND PsicologoId = ?`,
      [contenido, notaId, perfilId],
    );
    return (r.affectedRows ?? 0) > 0;
  },

  async eliminarNota(perfilId: string, notaId: string) {
    const r = await conexion.execute(
      `DELETE FROM notassesion WHERE NotaId = ? AND PsicologoId = ?`,
      [notaId, perfilId],
    );
    return (r.affectedRows ?? 0) > 0;
  },
};
