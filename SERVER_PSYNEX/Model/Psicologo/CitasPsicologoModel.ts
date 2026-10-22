import { conexion } from "../conexion.ts";
import type { ListarCitasPsicologoQuery } from "../../Validators/Psicologo/CitasPsicologoValidator.ts";

const FROM_JOINS = `
  FROM citas c
  LEFT JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
  LEFT JOIN usuarios up ON up.UsuarioId = COALESCE(pp.UsuarioId, c.PacienteId)
`;

export const CitasPsicologoModel = {

  // Lista paginada de SUS citas
  async listar(perfilId: string, filtros: ListarCitasPsicologoQuery) {
    const condiciones: string[] = ["c.PsicologoId = ?"];
    const params: (string | number)[] = [perfilId];

    if (filtros.estado && filtros.estado !== "todos") {
      condiciones.push("c.Estado = ?");
      params.push(filtros.estado);
    }
    if (filtros.fechaDesde) {
      condiciones.push("DATE(c.FechaHora) >= ?");
      params.push(filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      condiciones.push("DATE(c.FechaHora) <= ?");
      params.push(filtros.fechaHasta);
    }

    const where = `WHERE ${condiciones.join(" AND ")}`;
    const offset = (filtros.pagina - 1) * filtros.porPagina;

    const countResult = await conexion.query(
      `SELECT COUNT(*) AS total ${FROM_JOINS} ${where}`,
      params,
    );
    const total = Number(countResult[0]?.total ?? 0);

    const datos = await conexion.query(
      `SELECT
         c.CitaId, c.FechaHora, c.DuracionMinutos, c.Modalidad, c.Estado,
         c.RazonConsulta, c.LinkVideollamada, c.CreadoEn, c.PacienteId,
         COALESCE(up.NombreCompleto, 'Paciente') AS PacienteNombre,
         COALESCE(up.Email, '') AS PacienteEmail,
         up.FechaNacimiento AS PacienteFechaNacimiento,
         c.TipoCita,
         -- Estado del último pago de la cita (null si todavía no hay pago)
         (SELECT pg.EstadoPago FROM pagos pg
           WHERE pg.CitaId = c.CitaId
           ORDER BY pg.CreadoEn DESC LIMIT 1) AS EstadoPago
       ${FROM_JOINS}
       ${where}
       ORDER BY c.FechaHora DESC
       LIMIT ? OFFSET ?`,
      [...params, filtros.porPagina, offset],
    );

    return { datos, total };
  },

  // Para la vista Inicio
  async resumenHoy(perfilId: string) {
    const row = (await conexion.query(
      `SELECT
         COUNT(*) AS totalHoy,
         SUM(CASE WHEN Estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN Estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
         SUM(CASE WHEN Estado = 'Completada' THEN 1 ELSE 0 END) AS completadas
       FROM citas
       WHERE PsicologoId = ? AND DATE(FechaHora) = CURDATE()`,
      [perfilId],
    ))[0] ?? {};

    const proximas = await conexion.query(
      `SELECT
         c.CitaId, c.FechaHora, c.Modalidad, c.Estado,
         COALESCE(up.NombreCompleto, 'Paciente') AS PacienteNombre
       ${FROM_JOINS}
       WHERE c.PsicologoId = ?
         AND c.FechaHora >= NOW()
         AND c.Estado IN ('Pendiente', 'Confirmada')
       ORDER BY c.FechaHora ASC
       LIMIT 5`,
      [perfilId],
    );

    return {
      totalHoy: Number(row.totalHoy ?? 0),
      pendientes: Number(row.pendientes ?? 0),
      confirmadas: Number(row.confirmadas ?? 0),
      completadas: Number(row.completadas ?? 0),
      proximasCitas: proximas,
    };
  },

  async buscarPorId(citaId: string, perfilId: string) {
    const rows = await conexion.query(
      `SELECT
         c.*,
         COALESCE(up.NombreCompleto, 'Paciente') AS PacienteNombre,
         COALESCE(up.Email, '') AS PacienteEmail
       ${FROM_JOINS}
       WHERE c.CitaId = ? AND c.PsicologoId = ?
       LIMIT 1`,
      [citaId, perfilId],
    );
    return rows[0] ?? null;
  },

  // Cambia el estado de UNA cita del psicólogo.
  //  - Cancelada: guarda la fecha de cancelación (la usan las estadísticas).
  //  - Confirmada + Virtual: crea la sala de videollamada de la cita
  //    (una sola por cita; si ya existe no se duplica).
  async cambiarEstado(
    citaId: string,
    perfilId: string,
    estado: string,
    extras?: { linkVideollamada?: string },
  ): Promise<boolean> {
    const existe = await this.buscarPorId(citaId, perfilId);
    if (!existe) return false;

    await conexion.transaction(async (conn) => {
      const campos = ["Estado = ?"];
      const valores: unknown[] = [estado];

      if (extras?.linkVideollamada) {
        campos.push("LinkVideollamada = ?");
        valores.push(extras.linkVideollamada);
      }
      if (estado === "Cancelada") {
        campos.push("CanceladaEn = NOW()");
      }

      await conn.execute(
        `UPDATE citas SET ${campos.join(", ")} WHERE CitaId = ? AND PsicologoId = ?`,
        [...valores, citaId, perfilId],
      );

      if (estado === "Confirmada" && existe.Modalidad === "Virtual") {
        await conn.execute(
          `INSERT IGNORE INTO salasvideollamada (SalaId, CitaId, EstadoSala, CreadoEn)
           VALUES (?, ?, 'Activa', NOW())`,
          [crypto.randomUUID(), citaId],
        );
      }
    });
    return true;
  },
};