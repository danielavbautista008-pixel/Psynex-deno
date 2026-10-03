import { conexion } from "../conexion.ts";
import type { ListarCitasQuery } from "../../Validators/Administrador/CitasValidator.ts";

export interface CitaAdmin {
  CitaId: string;
  FechaHora: string;
  DuracionMinutos: number;
  Modalidad: string;
  Estado: string;
  RazonConsulta: string;
  LinkVideollamada: string | null;
  CreadoEn: string;
  PacienteId: string;
  PacienteNombre: string;
  PacienteEmail: string;
  PsicologoId: string;
  PsicologoNombre: string;
  PsicologoEmail: string;
}

export interface ResumenCitas {
  total: number;
  completadas: number;
  confirmadas: number;
  pendientes: number;
  canceladas: number;
  presenciales: number;
  virtuales: number;
}

// JOINs reutilizables
const FROM_JOINS = `
  FROM citas c
  INNER JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
  INNER JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
  INNER JOIN perfilpsicologo ppsi ON ppsi.PerfilId = c.PsicologoId
  INNER JOIN usuarios ups ON ups.UsuarioId = ppsi.UsuarioId
`;

const SELECT_CITA = `
  SELECT
    c.CitaId,
    c.FechaHora,
    c.DuracionMinutos,
    c.Modalidad,
    c.Estado,
    c.RazonConsulta,
    c.LinkVideollamada,
    c.CreadoEn,
    c.PacienteId,
    up.NombreCompleto AS PacienteNombre,
    up.Email AS PacienteEmail,
    c.PsicologoId,
    ups.NombreCompleto AS PsicologoNombre,
    ups.Email AS PsicologoEmail
`;

export const CitasModel = {

  async listar(filtros: ListarCitasQuery): Promise<{ citas: CitaAdmin[]; total: number }> {
    const condiciones: string[] = [];
    const params: (string | number)[] = [];

    if (filtros.estado && filtros.estado !== "todos") {
      condiciones.push("c.Estado = ?");
      params.push(filtros.estado);
    }

    if (filtros.modalidad && filtros.modalidad !== "todos") {
      condiciones.push("c.Modalidad = ?");
      params.push(filtros.modalidad);
    }

    if (filtros.fechaDesde) {
      condiciones.push("DATE(c.FechaHora) >= ?");
      params.push(filtros.fechaDesde);
    }

    if (filtros.fechaHasta) {
      condiciones.push("DATE(c.FechaHora) <= ?");
      params.push(filtros.fechaHasta);
    }

    if (filtros.busqueda) {
      condiciones.push(
        `(up.NombreCompleto LIKE ? OR ups.NombreCompleto LIKE ? OR up.Email LIKE ? OR ups.Email LIKE ?)`
      );
      const like = `%${filtros.busqueda}%`;
      params.push(like, like, like, like);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    // Total
    const countSql = `SELECT COUNT(*) AS total ${FROM_JOINS} ${where}`;
    const countResult = await conexion.query(countSql, params);
    const total = Number(countResult[0]?.total ?? 0);

    // Datos paginados
    const offset = (filtros.pagina - 1) * filtros.porPagina;
    const dataSql = `
      ${SELECT_CITA}
      ${FROM_JOINS}
      ${where}
      ORDER BY c.FechaHora DESC
      LIMIT ? OFFSET ?
    `;

    const citas = await conexion.query(dataSql, [
      ...params,
      filtros.porPagina,
      offset,
    ]);

    return { citas: citas as CitaAdmin[], total };
  },

  async resumen(): Promise<ResumenCitas> {
    const sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN Estado = 'Completada' THEN 1 ELSE 0 END) AS completadas,
        SUM(CASE WHEN Estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN Estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN Estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN Modalidad = 'Presencial' THEN 1 ELSE 0 END) AS presenciales,
        SUM(CASE WHEN Modalidad = 'Virtual' THEN 1 ELSE 0 END) AS virtuales
      FROM citas
    `;
    const result = await conexion.query(sql);
    const row = result[0] ?? {};

    return {
      total: Number(row.total ?? 0),
      completadas: Number(row.completadas ?? 0),
      confirmadas: Number(row.confirmadas ?? 0),
      pendientes: Number(row.pendientes ?? 0),
      canceladas: Number(row.canceladas ?? 0),
      presenciales: Number(row.presenciales ?? 0),
      virtuales: Number(row.virtuales ?? 0),
    };
  },

  async buscarPorId(citaId: string): Promise<CitaAdmin | null> {
    const sql = `
      ${SELECT_CITA}
      ${FROM_JOINS}
      WHERE c.CitaId = ?
      LIMIT 1
    `;
    const result = await conexion.query(sql, [citaId]);
    return (result[0] as CitaAdmin) ?? null;
  },
};