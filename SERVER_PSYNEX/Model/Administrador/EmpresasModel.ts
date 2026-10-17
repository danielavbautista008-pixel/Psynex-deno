import { conexion } from "../conexion.ts";
import type { ListarEmpresasQuery } from "../../Validators/Administrador/EmpresasValidator.ts";

export interface EmpresaVerificacion {
  PerfileId: string;
  UsuarioId: string;
  NombreEmpresa: string;
  Nit: string;
  Sector: string;
  Telefono: string;
  Direccion: string;
  SitioWeb: string;
  Descripcion: string;
  EstaVerificada: number;
  CreadoEn: string;
  NombreCompleto: string;
  Email: string;
  EstadoActivo: number;
}

const FROM_JOINS = `
  FROM perfilempresa pe
  INNER JOIN usuarios u ON u.UsuarioId = pe.UsuarioId
`;

export const EmpresasModel = {

  async listar(filtros: ListarEmpresasQuery) {
    const condiciones: string[] = [`u.Rol = 'Empresa'`];
    const params: (string | number)[] = [];

    if (filtros.estado === "pendiente") {
      condiciones.push(`pe.EstaVerificada = 0`);
    } else if (filtros.estado === "verificada") {
      condiciones.push(`pe.EstaVerificada = 1`);
    } else if (filtros.estado === "rechazada") {
      // Si no guardas rechazo aparte, se tratan como no verificadas.
      // Puedes filtrar igual que pendiente o ampliar después con una columna de estado.
      condiciones.push(`pe.EstaVerificada = 0`);
    }

    if (filtros.busqueda) {
      condiciones.push(
        `(pe.NombreEmpresa LIKE ? OR pe.Nit LIKE ? OR u.Email LIKE ? OR u.NombreCompleto LIKE ?)`,
      );
      const like = `%${filtros.busqueda}%`;
      params.push(like, like, like, like);
    }

    const where = `WHERE ${condiciones.join(" AND ")}`;
    const offset = (filtros.pagina - 1) * filtros.porPagina;

    const countResult = await conexion.query(
      `SELECT COUNT(*) AS total ${FROM_JOINS} ${where}`,
      params,
    );
    const total = Number(countResult[0]?.total ?? 0);

    const datos = await conexion.query(
      `
      SELECT
        pe.PerfileId,
        pe.UsuarioId,
        pe.NombreEmpresa,
        pe.Nit,
        pe.Sector,
        pe.Telefono,
        pe.Direccion,
        pe.SitioWeb,
        pe.Descripcion,
        pe.EstaVerificada,
        pe.CreadoEn,
        (pe.Logo LIKE 'data:image/%') AS TieneLogo,
        u.NombreCompleto,
        u.Email,
        u.EstadoActivo
      ${FROM_JOINS}
      ${where}
      ORDER BY pe.CreadoEn DESC
      LIMIT ? OFFSET ?
      `,
      [...params, filtros.porPagina, offset],
    );

    return { datos: datos as EmpresaVerificacion[], total };
  },

  async resumen() {
    const sql = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pe.EstaVerificada = 1 THEN 1 ELSE 0 END) AS verificadas,
        SUM(CASE WHEN pe.EstaVerificada = 0 THEN 1 ELSE 0 END) AS pendientes
      FROM perfilempresa pe
      INNER JOIN usuarios u ON u.UsuarioId = pe.UsuarioId AND u.Rol = 'Empresa'
    `;
    const row = (await conexion.query(sql))[0] ?? {};
    return {
      total: Number(row.total ?? 0),
      verificadas: Number(row.verificadas ?? 0),
      pendientes: Number(row.pendientes ?? 0),
    };
  },

  async buscarPorPerfileId(perfileId: string): Promise<EmpresaVerificacion | null> {
    const rows = await conexion.query(
      `
      SELECT
        pe.PerfileId, pe.UsuarioId, pe.NombreEmpresa, pe.Nit, pe.Sector,
        pe.Telefono, pe.Direccion, pe.SitioWeb, pe.Descripcion,
        pe.EstaVerificada, pe.CreadoEn,
        u.NombreCompleto, u.Email, u.EstadoActivo
      ${FROM_JOINS}
      WHERE pe.PerfileId = ?
      LIMIT 1
      `,
      [perfileId],
    );
    return (rows[0] as EmpresaVerificacion) ?? null;
  },

  async aprobar(perfileId: string): Promise<boolean> {
    const existe = await conexion.query(
      `SELECT PerfileId FROM perfilempresa WHERE PerfileId = ? LIMIT 1`,
      [perfileId],
    );
    if (!existe[0]) return false;

    await conexion.execute(
      `UPDATE perfilempresa SET EstaVerificada = 1 WHERE PerfileId = ?`,
      [perfileId],
    );
    return true;
  },

  async rechazar(perfileId: string): Promise<boolean> {
    const existe = await conexion.query(
      `SELECT PerfileId FROM perfilempresa WHERE PerfileId = ? LIMIT 1`,
      [perfileId],
    );
    if (!existe[0]) return false;

    // Queda como no verificada (misma bandera de la BD)
    await conexion.execute(
      `UPDATE perfilempresa SET EstaVerificada = 0 WHERE PerfileId = ?`,
      [perfileId],
    );
    return true;
  },

  // Documentos que subió la empresa al registrarse (sin la ruta interna)
  // Logo de la empresa (data URL guardada en perfilempresa.Logo)
  async logo(perfileId: string): Promise<string | null> {
    const [fila] = await conexion.query(
      `SELECT Logo FROM perfilempresa WHERE PerfileId = ? LIMIT 1`,
      [perfileId],
    );
    return fila?.Logo ? String(fila.Logo) : null;
  },

  async listarDocumentos(perfileId: string) {
    return await conexion.query(
      `SELECT d.DocumentoArchivoId, d.Tipo, d.NombreOriginal, d.Mime, d.TamanoBytes, d.CreadoEn
       FROM documentos d
       JOIN perfilempresa pe ON pe.UsuarioId = d.UsuarioId
       WHERE pe.PerfileId = ?
       ORDER BY d.CreadoEn`,
      [perfileId],
    );
  },
};
