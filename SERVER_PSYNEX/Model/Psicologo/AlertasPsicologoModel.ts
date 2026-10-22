import { conexion } from "../conexion.ts";
import type { ListarAlertasQuery } from "../../Validators/Psicologo/AlertasPsicologoValidator.ts";

const SELECT_ALERTA = `
  SELECT a.AlertaId, a.NivelRiesgo, a.FueAtendida, a.FechaAlerta, a.FechaAtencion,
         a.PacienteId,
         CASE WHEN pp.EsAnonimo = 1 THEN 'Paciente anónimo'
              ELSE COALESCE(u.NombreCompleto, 'Paciente') END AS PacienteNombre,
         r.ResultadoId, r.PuntajeTotal, r.Interpretacion, r.FechaRespuesta,
         c.CuestionarioId, c.NombreCuestionario, c.PuntajeMaximo
  FROM alertas a
  LEFT JOIN perfilpaciente pp ON pp.PerfiluId = a.PacienteId
  LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
  JOIN resultadocuestionario r ON r.ResultadoId = a.ResultadoId
  JOIN cuestionarios c ON c.CuestionarioId = r.CuestionarioId
`;

export const AlertasPsicologoModel = {

  // Alertas asignadas a este psicólogo: primero las pendientes, luego las más recientes
  async listar(perfilId: string, filtros: ListarAlertasQuery) {
    const condiciones = ["a.PsicologoId = ?"];
    if (filtros.estado === "pendientes") condiciones.push("a.FueAtendida = 0");
    if (filtros.estado === "atendidas") condiciones.push("a.FueAtendida = 1");

    const alertas = await conexion.query(
      `${SELECT_ALERTA}
       WHERE ${condiciones.join(" AND ")}
       ORDER BY a.FueAtendida ASC, a.FechaAlerta DESC`,
      [perfilId],
    );

    const [resumen] = await conexion.query(
      `SELECT COUNT(*) AS total,
              SUM(FueAtendida = 0) AS pendientes,
              SUM(FueAtendida = 1) AS atendidas
       FROM alertas WHERE PsicologoId = ?`,
      [perfilId],
    );

    return {
      alertas,
      resumen: {
        total: Number(resumen?.total ?? 0),
        pendientes: Number(resumen?.pendientes ?? 0),
        atendidas: Number(resumen?.atendidas ?? 0),
      },
    };
  },

  async buscarPorId(perfilId: string, alertaId: string) {
    const [alerta] = await conexion.query(
      `${SELECT_ALERTA} WHERE a.AlertaId = ? AND a.PsicologoId = ? LIMIT 1`,
      [alertaId, perfilId],
    );
    if (!alerta) return null;

    const acciones = await conexion.query(
      `SELECT ProtocoloId, Descripcion, FechaAccion
       FROM protocolosaccion WHERE AlertaId = ? ORDER BY FechaAccion DESC`,
      [alertaId],
    );
    return { ...alerta, acciones };
  },

  // Marca la alerta como atendida y, si se envía, registra la acción tomada.
  async atender(perfilId: string, alertaId: string, accion?: string) {
    return await conexion.transaction(async (conn) => {
      const r = await conn.execute(
        `UPDATE alertas SET FueAtendida = 1, FechaAtencion = COALESCE(FechaAtencion, NOW())
         WHERE AlertaId = ? AND PsicologoId = ?`,
        [alertaId, perfilId],
      );
      if ((r.affectedRows ?? 0) === 0) return false;

      if (accion) {
        await conn.execute(
          `INSERT INTO protocolosaccion (ProtocoloId, AlertaId, Descripcion, FechaAccion)
           VALUES (?, ?, ?, NOW())`,
          [crypto.randomUUID(), alertaId, accion],
        );
      }
      return true;
    });
  },
};
