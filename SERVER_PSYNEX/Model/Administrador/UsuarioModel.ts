import { conexion } from "../conexion.ts";
import type { FiltroUsuariosInput } from "../../Validators/Administrador/UsuarioValidator.ts";

// Valor EXACTO del rol de administrador en la base de datos.
const ROL_ADMIN = "Admin";

export interface UsuarioRow {
  UsuarioId: string;
  NombreCompleto: string;
  FechaNacimiento: string;
  Rol: string;
  Email: string;
  PasswordHash: string;
  EstadoActivo: number;
  CreadoEn: string;
}

// Escapa % y _ para que lo que escribe el administrador en el buscador se tome literal.
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

// Consulta base del listado: datos de la cuenta + teléfono, documento y verificación
// según el rol. Los administradores se excluyen siempre (primer "?").
// Las subconsultas con LIMIT 1 evitan filas duplicadas si hay más de un registro relacionado.
const BASE_LISTADO = `
  SELECT u.UsuarioId, u.NombreCompleto, u.Rol, u.Email, u.EstadoActivo, u.CreadoEn,
    CASE
      WHEN u.Rol = 'Paciente' AND COALESCE(pp.EsAnonimo, 0) = 1 THEN NULL
      WHEN u.Rol = 'Paciente' THEN NULLIF(pp.Telefono, '')
      WHEN u.Rol = 'Psicologo' THEN NULLIF(ps.Telefono, '')
      WHEN u.Rol = 'Empresa' THEN (
        SELECT NULLIF(pe.Telefono, '') FROM perfilempresa pe
        WHERE pe.UsuarioId = u.UsuarioId LIMIT 1)
    END AS Telefono,
    CASE
      WHEN u.Rol = 'Psicologo' THEN (
        SELECT d.Cedula FROM documentosverificacion d
        WHERE d.PerfilId = ps.PerfilId ORDER BY d.CreadoEn DESC LIMIT 1)
      WHEN u.Rol = 'Empresa' THEN (
        SELECT pe.Nit FROM perfilempresa pe
        WHERE pe.UsuarioId = u.UsuarioId LIMIT 1)
    END AS Documento,
    CASE
      WHEN u.Rol = 'Psicologo' THEN ps.EstaVerificado
      WHEN u.Rol = 'Empresa' THEN (
        SELECT pe.EstaVerificada FROM perfilempresa pe
        WHERE pe.UsuarioId = u.UsuarioId LIMIT 1)
    END AS Verificado
  FROM usuarios u
  LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
  LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
  WHERE u.Rol <> ?`;

export const UsuarioModel = {
  async crear(data: {
    nombreCompleto: string;
    fechaNacimiento: string;
    rol: string;
    email: string;
    passwordHash: string;
  }) {
    const usuarioId = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO usuarios (UsuarioId, NombreCompleto, FechaNacimiento, Rol, Email, PasswordHash, EstadoActivo, CreadoEn)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [usuarioId, data.nombreCompleto, data.fechaNacimiento, data.rol, data.email, data.passwordHash],
    );
    return usuarioId;
  },

  async buscarPorEmail(email: string): Promise<UsuarioRow | undefined> {
    const rows = await conexion.query(`SELECT * FROM usuarios WHERE Email = ? LIMIT 1`, [email]);
    return rows[0];
  },

  async buscarPorId(usuarioId: string): Promise<UsuarioRow | undefined> {
    const rows = await conexion.query(`SELECT * FROM usuarios WHERE UsuarioId = ? LIMIT 1`, [usuarioId]);
    return rows[0];
  },

  // RF-40 — listado paginado con filtros por rol, estado y búsqueda (nombre, correo o documento).
  async listar(filtro: FiltroUsuariosInput) {
    const condiciones: string[] = [];
    const valores: unknown[] = [ROL_ADMIN];

    if (filtro.rol) {
      condiciones.push("t.Rol = ?");
      valores.push(filtro.rol);
    }
    if (filtro.estadoActivo !== undefined) {
      condiciones.push("t.EstadoActivo = ?");
      valores.push(filtro.estadoActivo === "true" ? 1 : 0);
    }
    if (filtro.busqueda) {
      condiciones.push("(t.NombreCompleto LIKE ? OR t.Email LIKE ? OR t.Documento LIKE ?)");
      const patron = `%${escaparLike(filtro.busqueda)}%`;
      valores.push(patron, patron, patron);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const offset = (filtro.pagina - 1) * filtro.porPagina;

    const totalRows = await conexion.query(
      `SELECT COUNT(*) AS total FROM (${BASE_LISTADO}) t ${where}`,
      valores,
    );

    const datos = await conexion.query(
      `SELECT * FROM (${BASE_LISTADO}) t ${where}
       ORDER BY t.CreadoEn DESC
       LIMIT ? OFFSET ?`,
      [...valores, filtro.porPagina, offset],
    );

    return {
      datos,
      total: Number(totalRows[0].total),
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  },

  // Conteos para el modal "Ver resumen" (sin contar administradores).
  async resumen() {
    const filas = await conexion.query(
      `SELECT Rol, EstadoActivo, COUNT(*) AS n
       FROM usuarios WHERE Rol <> ? GROUP BY Rol, EstadoActivo`,
      [ROL_ADMIN],
    );

    const r = { total: 0, pacientes: 0, psicologos: 0, empresas: 0, activos: 0, inactivos: 0 };
    for (const f of filas) {
      const n = Number(f.n);
      r.total += n;
      if (f.Rol === "Paciente") r.pacientes += n;
      if (f.Rol === "Psicologo") r.psicologos += n;
      if (f.Rol === "Empresa") r.empresas += n;
      if (f.EstadoActivo) r.activos += n;
      else r.inactivos += n;
    }
    return r;
  },

  // RF-40 — activar o desactivar una cuenta Y dejar la observación, todo en una transacción:
  // o se guardan las dos cosas, o ninguna. Un Admin nunca se modifica (segunda barrera).
  // Devuelve las filas afectadas (0 = no se cambió nada).
  async cambiarEstado(
    usuarioId: string,
    estadoActivo: boolean,
    adminId: string,
    motivo: string,
  ): Promise<number> {
    return await conexion.transaction(async (conn) => {
      const resultado = await conn.execute(
        `UPDATE usuarios SET EstadoActivo = ? WHERE UsuarioId = ? AND Rol <> ?`,
        [estadoActivo ? 1 : 0, usuarioId, ROL_ADMIN],
      );
      const filas = resultado.affectedRows ?? 0;
      if (filas === 0) return 0;

      await conn.execute(
        `INSERT INTO observacionesusuario (ObservacionId, UsuarioId, AdminId, Tipo, Texto)
         VALUES (?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          usuarioId,
          adminId,
          estadoActivo ? "activacion" : "desactivacion",
          motivo || (estadoActivo ? "Cuenta reactivada" : "Cuenta desactivada"),
        ],
      );
      return filas;
    });
  },

  // Historial de observaciones de un usuario, de la más reciente a la más antigua.
  async listarObservaciones(usuarioId: string) {
    return await conexion.query(
      `SELECT o.ObservacionId, o.Tipo, o.Texto, o.CreadoEn, a.NombreCompleto AS AdminNombre
       FROM observacionesusuario o
       JOIN usuarios a ON a.UsuarioId = o.AdminId
       WHERE o.UsuarioId = ?
       ORDER BY o.CreadoEn DESC
       LIMIT 100`,
      [usuarioId],
    );
  },

  // Nota libre del administrador.
  async agregarObservacion(usuarioId: string, adminId: string, texto: string) {
    const observacionId = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO observacionesusuario (ObservacionId, UsuarioId, AdminId, Tipo, Texto)
       VALUES (?, ?, ?, 'nota', ?)`,
      [observacionId, usuarioId, adminId, texto],
    );
    return observacionId;
  },
};