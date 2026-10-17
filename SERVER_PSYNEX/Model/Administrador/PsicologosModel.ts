import { conexion } from "../conexion.ts";
import type { ListarPsicologosQuery } from "../../Validators/Administrador/PsicologosValidator.ts";

export interface PsicologoVerificacion {
  PerfilId: string;
  UsuarioId: string;
  NombreCompleto: string;
  Email: string;
  Telefono: string | null;
  Biografia: string | null;
  Modalidad: string | null;
  PrecioPorHora: number | null;
  Direccion: string | null;
  EstaVerificado: number;
  CreadoEn: string;
  Cedula: string | null;
  NivelTitulo: string | null;
  EstadoVerificacion: string | null;
  FechaVerificacion: string | null;
  DocumentoId: string | null;
  Especialidades: string | null;
  AniosExperiencia: number | null;
}

const FROM_JOINS = `
  FROM perfilpsicologo p
  INNER JOIN usuarios u ON u.UsuarioId = p.UsuarioId
  LEFT JOIN documentosverificacion d ON d.PerfilId = p.PerfilId
    AND d.CreadoEn = (
      SELECT MAX(d2.CreadoEn) FROM documentosverificacion d2
      WHERE d2.PerfilId = p.PerfilId
    )
`;

export const PsicologosModel = {

  async listar(filtros: ListarPsicologosQuery) {
    const condiciones: string[] = [`u.Rol = 'Psicologo'`, `u.EstadoActivo = 1`];
    const params: (string | number)[] = [];

    if (filtros.estado === "pendiente") {
      // No verificado aún (o documento en pendiente)
      condiciones.push(`(p.EstaVerificado = 0 OR p.EstaVerificado IS NULL)`);
      condiciones.push(`(d.EstadoVerificacion IS NULL OR d.EstadoVerificacion IN ('Pendiente', 'pendiente'))`);
    } else if (filtros.estado === "verificado") {
      condiciones.push(`p.EstaVerificado = 1`);
    } else if (filtros.estado === "rechazado") {
      condiciones.push(`d.EstadoVerificacion IN ('Rechazado', 'rechazado')`);
      condiciones.push(`p.EstaVerificado = 0`);
    }

    if (filtros.busqueda) {
      condiciones.push(`(u.NombreCompleto LIKE ? OR u.Email LIKE ? OR d.Cedula LIKE ?)`);
      const like = `%${filtros.busqueda}%`;
      params.push(like, like, like);
    }

    const where = `WHERE ${condiciones.join(" AND ")}`;
    const offset = (filtros.pagina - 1) * filtros.porPagina;

    const countSql = `SELECT COUNT(*) AS total ${FROM_JOINS} ${where}`;
    const countResult = await conexion.query(countSql, params);
    const total = Number(countResult[0]?.total ?? 0);

    const dataSql = `
      SELECT
        p.PerfilId,
        p.UsuarioId,
        u.NombreCompleto,
        u.Email,
        p.Telefono,
        p.Biografia,
        p.Modalidad,
        p.PrecioPorHora,
        p.Direccion,
        p.EstaVerificado,
        p.CreadoEn,
        (p.Foto LIKE 'data:image/%') AS TieneFoto,
        d.DocumentoId,
        d.Cedula,
        d.NivelTitulo,
        d.EstadoVerificacion,
        d.FechaVerificacion,
        -- Especialidades separadas por coma (para la lista del admin)
        (SELECT GROUP_CONCAT(e.NombreEspecialidad ORDER BY e.NombreEspecialidad SEPARATOR ', ')
           FROM psicologoespecialidad pe
           JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
          WHERE pe.PerfilId = p.PerfilId) AS Especialidades,
        -- Años desde su primer trabajo registrado
        (SELECT TIMESTAMPDIFF(YEAR, MIN(x.FechaInicio), NOW())
           FROM experiencia x
          WHERE x.PerfileId = p.PerfilId) AS AniosExperiencia
      ${FROM_JOINS}
      ${where}
      ORDER BY p.CreadoEn DESC
      LIMIT ? OFFSET ?
    `;

    const datos = await conexion.query(dataSql, [
      ...params,
      filtros.porPagina,
      offset,
    ]);

    return { datos: datos as PsicologoVerificacion[], total };
  },

  async resumen() {
    const sql = `
      SELECT
        SUM(CASE WHEN p.EstaVerificado = 1 THEN 1 ELSE 0 END) AS verificados,
        SUM(CASE WHEN p.EstaVerificado = 0 AND (d.EstadoVerificacion IS NULL OR d.EstadoVerificacion IN ('Pendiente','pendiente')) THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN d.EstadoVerificacion IN ('Rechazado','rechazado') THEN 1 ELSE 0 END) AS rechazados,
        COUNT(*) AS total
      FROM perfilpsicologo p
      INNER JOIN usuarios u ON u.UsuarioId = p.UsuarioId AND u.Rol = 'Psicologo'
      LEFT JOIN documentosverificacion d ON d.PerfilId = p.PerfilId
        AND d.CreadoEn = (
          SELECT MAX(d2.CreadoEn) FROM documentosverificacion d2
          WHERE d2.PerfilId = p.PerfilId
        )
    `;
    const row = (await conexion.query(sql))[0] ?? {};
    return {
      total: Number(row.total ?? 0),
      verificados: Number(row.verificados ?? 0),
      pendientes: Number(row.pendientes ?? 0),
      rechazados: Number(row.rechazados ?? 0),
    };
  },

  async buscarPorPerfilId(perfilId: string): Promise<PsicologoVerificacion | null> {
    const sql = `
      SELECT
        p.PerfilId, p.UsuarioId, u.NombreCompleto, u.Email,
        p.Telefono, p.Biografia, p.Modalidad, p.PrecioPorHora, p.Direccion,
        p.EstaVerificado, p.CreadoEn,
        d.DocumentoId, d.Cedula, d.NivelTitulo, d.EstadoVerificacion, d.FechaVerificacion
      ${FROM_JOINS}
      WHERE p.PerfilId = ?
      LIMIT 1
    `;
    const rows = await conexion.query(sql, [perfilId]);
    return (rows[0] as PsicologoVerificacion) ?? null;
  },

  async aprobar(perfilId: string): Promise<boolean> {
    return await conexion.transaction(async (conn) => {
      const r1 = await conn.execute(
        `UPDATE perfilpsicologo SET EstaVerificado = 1 WHERE PerfilId = ?`,
        [perfilId],
      );
      if ((r1.affectedRows ?? 0) === 0) return false;

      // Actualiza el documento más reciente, o no hace nada si no hay
      const r2 = await conn.execute(
        `UPDATE documentosverificacion
         SET EstadoVerificacion = 'Aprobado', FechaVerificacion = NOW()
         WHERE PerfilId = ?
         ORDER BY CreadoEn DESC
         LIMIT 1`,
        [perfilId],
      );

      // Si el psicólogo aún no tenía registro de verificación, lo creamos
      // para que la decisión quede guardada (si no, seguiría "Pendiente").
      if ((r2.affectedRows ?? 0) === 0) {
        await conn.execute(
          `INSERT INTO documentosverificacion
             (DocumentoId, PerfilId, Cedula, NivelTitulo, EstadoVerificacion, FechaVerificacion, CreadoEn)
           VALUES (?, ?, '', '', 'Aprobado', NOW(), NOW())`,
          [crypto.randomUUID(), perfilId],
        );
      }
      return true;
    });
  },

  async rechazar(perfilId: string, _motivo: string): Promise<boolean> {
    return await conexion.transaction(async (conn) => {
      const r1 = await conn.execute(
        `UPDATE perfilpsicologo SET EstaVerificado = 0 WHERE PerfilId = ?`,
        [perfilId],
      );
      if ((r1.affectedRows ?? 0) === 0) return false;

      const r2 = await conn.execute(
        `UPDATE documentosverificacion
         SET EstadoVerificacion = 'Rechazado', FechaVerificacion = NOW()
         WHERE PerfilId = ?
         ORDER BY CreadoEn DESC
         LIMIT 1`,
        [perfilId],
      );

      // Si el psicólogo aún no tenía registro de verificación, lo creamos
      // para que la decisión quede guardada (si no, seguiría "Pendiente").
      if ((r2.affectedRows ?? 0) === 0) {
        await conn.execute(
          `INSERT INTO documentosverificacion
             (DocumentoId, PerfilId, Cedula, NivelTitulo, EstadoVerificacion, FechaVerificacion, CreadoEn)
           VALUES (?, ?, '', '', 'Rechazado', NOW(), NOW())`,
          [crypto.randomUUID(), perfilId],
        );
      }
      return true;
    });
  },

  // Documentos que subió el psicólogo al registrarse (sin la ruta interna)
  // Foto de perfil del psicólogo (data URL guardada en perfilpsicologo.Foto)
  async foto(perfilId: string): Promise<string | null> {
    const [fila] = await conexion.query(
      `SELECT Foto FROM perfilpsicologo WHERE PerfilId = ? LIMIT 1`,
      [perfilId],
    );
    return fila?.Foto ? String(fila.Foto) : null;
  },

  async listarDocumentos(perfilId: string) {
    return await conexion.query(
      `SELECT d.DocumentoArchivoId, d.Tipo, d.NombreOriginal, d.Mime, d.TamanoBytes, d.CreadoEn
       FROM documentos d
       JOIN perfilpsicologo p ON p.UsuarioId = d.UsuarioId
       WHERE p.PerfilId = ?
       ORDER BY d.CreadoEn`,
      [perfilId],
    );
  },

  async obtenerDocumento(documentoId: string) {
    const rows = await conexion.query(
      `SELECT DocumentoArchivoId, RutaArchivo, Mime, NombreOriginal
       FROM documentos WHERE DocumentoArchivoId = ? LIMIT 1`,
      [documentoId],
    );
    return rows[0] ?? null;
  },
};