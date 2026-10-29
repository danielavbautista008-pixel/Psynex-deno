// =====================================================================
// PANEL DE EMPRESA (carpeta empresa.e).
// Todo se busca con la sesión de la empresa (perfilempresa.UsuarioId), así
// una empresa solo ve y cambia lo suyo.
// Tablas: perfilempresa, usuarios, ofertaslaborales, postulaciones,
// empresafavoritos, perfilpsicologo, notificaciones.
// =====================================================================
import { conexion } from "../conexion.ts";
import type { OfertaInput, PerfilEmpresaInput } from "../../Validators/empresa.e/PanelEmpresaValidator.ts";

type Fila = Record<string, unknown>;
type Resultado<T> = T | { error: string; status: number };
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// Perfil de empresa de quien inició sesión
async function empresaDe(usuarioId: string) {
  const [f] = await conexion.query(
    `SELECT PerfileId, NombreEmpresa FROM perfilempresa WHERE UsuarioId = ? LIMIT 1`,
    [usuarioId],
  ) as Fila[];
  return f ? { perfilId: texto(f.PerfileId), nombre: texto(f.NombreEmpresa) } : null;
}

async function notificar(usuarioId: string, titulo: string, mensaje: string) {
  await conexion.execute(
    `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
     VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
    [crypto.randomUUID(), usuarioId, titulo, mensaje],
  ).catch((e) => console.error("Notificación:", e));
}

const SIN_PERFIL = { error: "No encontramos el perfil de tu empresa.", status: 404 };

export const PanelEmpresaModel = {
  // ------------------------------------------------------------------
  // Perfil
  // ------------------------------------------------------------------
  async perfil(usuarioId: string) {
    const [f] = await conexion.query(
      `SELECT pe.PerfileId, pe.NombreEmpresa, pe.Nit, pe.Sector, pe.CantidadEmpleados, pe.Telefono,
              pe.Direccion, pe.SitioWeb, pe.Logo, pe.Descripcion, pe.EstaVerificada, u.Email
       FROM perfilempresa pe JOIN usuarios u ON u.UsuarioId = pe.UsuarioId
       WHERE pe.UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (!f) return null;
    const logo = texto(f.Logo);
    return {
      PerfilId: texto(f.PerfileId),
      NombreEmpresa: texto(f.NombreEmpresa),
      Nit: texto(f.Nit),
      Sector: texto(f.Sector),
      CantidadEmpleados: f.CantidadEmpleados === null ? null : Number(f.CantidadEmpleados),
      Telefono: texto(f.Telefono),
      Direccion: texto(f.Direccion),
      SitioWeb: texto(f.SitioWeb),
      Descripcion: texto(f.Descripcion),
      Logo: logo.startsWith("data:image/") ? logo : "",
      EstaVerificada: Number(f.EstaVerificada ?? 0) === 1,
      Email: texto(f.Email),
    };
  },

  async actualizarPerfil(usuarioId: string, d: PerfilEmpresaInput): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const campos = ["NombreEmpresa = ?", "Nit = ?", "Sector = ?", "Descripcion = ?", "SitioWeb = ?", "Telefono = ?"];
    const valores: unknown[] = [d.nombreEmpresa, d.nit, d.sector, d.descripcion, d.sitioWeb, d.telefono];
    if (d.direccion !== undefined) {
      campos.push("Direccion = ?");
      valores.push(d.direccion);
    }
    if (d.logo) {
      campos.push("Logo = ?");
      valores.push(d.logo);
    }
    await conexion.transaction(async (conn) => {
      await conn.execute(`UPDATE perfilempresa SET ${campos.join(", ")} WHERE PerfileId = ?`, [...valores, emp.perfilId]);
      // El nombre de la cuenta es el nombre de la empresa (se ve en el menú y en los correos)
      await conn.execute(`UPDATE usuarios SET NombreCompleto = ? WHERE UsuarioId = ?`, [d.nombreEmpresa, usuarioId]);
    });
    return { ok: true };
  },

  // ------------------------------------------------------------------
  // Inicio: números y últimas postulaciones
  // ------------------------------------------------------------------
  async resumen(usuarioId: string): Promise<Resultado<Record<string, unknown>>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const [n] = await conexion.query(
      `SELECT
         (SELECT COUNT(*) FROM ofertaslaborales WHERE PerfileId = ? AND Estado = 'Activa') AS Ofertas,
         (SELECT COUNT(*) FROM postulaciones po JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
           WHERE o.PerfileId = ?) AS Postulaciones,
         (SELECT COUNT(*) FROM empresafavoritos WHERE PerfileId = ?) AS Favoritos`,
      [emp.perfilId, emp.perfilId, emp.perfilId],
    ) as Fila[];
    const ultimas = await conexion.query(
      `SELECT po.PostulacionId, po.Estado, DATE_FORMAT(po.FechaPostulacion, '%Y-%m-%d') AS Fecha,
              o.Titulo, u.NombreCompleto, ps.PerfilId,
              (ps.Foto IS NOT NULL AND ps.Foto LIKE 'data:image/%') AS TieneFoto, CRC32(ps.Foto) AS FotoVersion
       FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN usuarios u ON u.UsuarioId = po.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE o.PerfileId = ?
       ORDER BY po.FechaPostulacion DESC
       LIMIT 5`,
      [emp.perfilId],
    ) as Fila[];
    return {
      nombre: emp.nombre,
      ofertasActivas: Number(n?.Ofertas ?? 0),
      postulaciones: Number(n?.Postulaciones ?? 0),
      favoritos: Number(n?.Favoritos ?? 0),
      ultimas: ultimas.map((f) => ({
        id: texto(f.PostulacionId),
        estado: texto(f.Estado) || "Pendiente",
        fecha: texto(f.Fecha),
        oferta: texto(f.Titulo),
        nombre: texto(f.NombreCompleto),
        perfilId: f.PerfilId ? texto(f.PerfilId) : null,
        tieneFoto: Number(f.TieneFoto ?? 0) === 1,
        fotoVersion: f.FotoVersion === null || f.FotoVersion === undefined ? "" : texto(f.FotoVersion),
      })),
    };
  },

  // ------------------------------------------------------------------
  // Ofertas
  // ------------------------------------------------------------------
  async ofertas(usuarioId: string): Promise<Resultado<Record<string, unknown>[]>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const filas = await conexion.query(
      `SELECT o.OfertaId, o.Titulo, o.Descripcion, o.Requisitos, o.Salario, o.Modalidad, o.Estado,
              DATE_FORMAT(o.FechaPublicacion, '%Y-%m-%d') AS Fecha,
              (SELECT COUNT(*) FROM postulaciones po WHERE po.OfertaId = o.OfertaId) AS Postulaciones
       FROM ofertaslaborales o
       WHERE o.PerfileId = ?
       ORDER BY o.Estado = 'Activa' DESC, o.FechaPublicacion DESC`,
      [emp.perfilId],
    ) as Fila[];
    return filas.map((f) => ({
      id: texto(f.OfertaId),
      titulo: texto(f.Titulo),
      descripcion: texto(f.Descripcion),
      requisitos: texto(f.Requisitos),
      salario: f.Salario === null || f.Salario === undefined ? null : Number(f.Salario),
      modalidad: texto(f.Modalidad),
      estado: texto(f.Estado),
      fecha: texto(f.Fecha),
      postulaciones: Number(f.Postulaciones ?? 0),
    }));
  },

  async crearOferta(usuarioId: string, d: OfertaInput): Promise<Resultado<{ id: string }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const id = crypto.randomUUID();
    const salario = d.salario === "" || d.salario === null || d.salario === undefined ? null : Number(d.salario);
    await conexion.execute(
      `INSERT INTO ofertaslaborales (OfertaId, PerfileId, Titulo, Descripcion, Requisitos, Salario, Modalidad, Estado, FechaPublicacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Activa', NOW())`,
      [id, emp.perfilId, d.titulo, d.descripcion, d.requisitos, salario, d.modalidad],
    );
    return { id };
  },

  async editarOferta(usuarioId: string, ofertaId: string, d: OfertaInput): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const salario = d.salario === "" || d.salario === null || d.salario === undefined ? null : Number(d.salario);
    const r = await conexion.execute(
      `UPDATE ofertaslaborales SET Titulo = ?, Descripcion = ?, Requisitos = ?, Salario = ?, Modalidad = ?
       WHERE OfertaId = ? AND PerfileId = ?`,
      [d.titulo, d.descripcion, d.requisitos, salario, d.modalidad, ofertaId, emp.perfilId],
    );
    if (!r.affectedRows) return { error: "Oferta no encontrada.", status: 404 };
    return { ok: true };
  },

  async estadoOferta(usuarioId: string, ofertaId: string, estado: "Activa" | "Cerrada"): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const r = await conexion.execute(
      `UPDATE ofertaslaborales SET Estado = ? WHERE OfertaId = ? AND PerfileId = ?`,
      [estado, ofertaId, emp.perfilId],
    );
    if (!r.affectedRows) return { error: "Oferta no encontrada.", status: 404 };
    return { ok: true };
  },

  // ------------------------------------------------------------------
  // Postulaciones: aceptar / rechazar (avisa al psicólogo)
  // ------------------------------------------------------------------
  async estadoPostulacion(usuarioId: string, postulacionId: string, estado: string): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const [p] = await conexion.query(
      `SELECT po.UsuarioId, o.Titulo FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       WHERE po.PostulacionId = ? AND o.PerfileId = ? LIMIT 1`,
      [postulacionId, emp.perfilId],
    ) as Fila[];
    if (!p) return { error: "Postulación no encontrada.", status: 404 };
    await conexion.execute(`UPDATE postulaciones SET Estado = ? WHERE PostulacionId = ?`, [estado, postulacionId]);
    if (estado !== "Pendiente") {
      await notificar(
        texto(p.UsuarioId),
        estado === "Aceptado" ? "¡Tu postulación fue aceptada!" : "Tu postulación fue revisada",
        estado === "Aceptado"
          ? `${emp.nombre} aceptó tu postulación a "${texto(p.Titulo)}". Pronto se comunicarán contigo.`
          : `${emp.nombre} revisó tu postulación a "${texto(p.Titulo)}" y en esta ocasión siguió con otro perfil.`,
      );
    }
    return { ok: true };
  },

  // ------------------------------------------------------------------
  // Favoritos
  // ------------------------------------------------------------------
  async favoritos(usuarioId: string): Promise<Resultado<Record<string, unknown>[]>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const filas = await conexion.query(
      `SELECT ps.PerfilId, u.NombreCompleto, ps.PrecioPorHora, ps.Modalidad,
              (ps.Foto IS NOT NULL AND ps.Foto LIKE 'data:image/%') AS TieneFoto, CRC32(ps.Foto) AS FotoVersion,
              (SELECT GROUP_CONCAT(e.NombreEspecialidad ORDER BY e.NombreEspecialidad SEPARATOR '|')
                 FROM psicologoespecialidad pe JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
                WHERE pe.PerfilId = ps.PerfilId) AS Especialidades,
              (SELECT e.Titulo FROM estudios e WHERE e.PerfilId = ps.PerfilId
                ORDER BY e.EnCurso ASC, e.FechaGrado DESC LIMIT 1) AS Titulo
       FROM empresafavoritos f
       JOIN perfilpsicologo ps ON ps.PerfilId = f.PerfilPsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       WHERE f.PerfileId = ?
       ORDER BY f.CreadoEn DESC`,
      [emp.perfilId],
    ) as Fila[];
    return filas.map((f) => ({
      id: texto(f.PerfilId),
      nombre: texto(f.NombreCompleto),
      titulo: texto(f.Titulo) || "Psicólogo/a",
      especialidades: texto(f.Especialidades).split("|").filter(Boolean),
      modalidad: texto(f.Modalidad),
      precio: Number(f.PrecioPorHora ?? 0),
      tieneFoto: Number(f.TieneFoto ?? 0) === 1,
      fotoVersion: f.FotoVersion === null || f.FotoVersion === undefined ? "" : texto(f.FotoVersion),
    }));
  },

  async idsFavoritos(usuarioId: string): Promise<string[]> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return [];
    const filas = await conexion.query(
      `SELECT PerfilPsicologoId FROM empresafavoritos WHERE PerfileId = ?`,
      [emp.perfilId],
    ) as Fila[];
    return filas.map((f) => texto(f.PerfilPsicologoId));
  },

  async agregarFavorito(usuarioId: string, perfilPsicologoId: string): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    const [ps] = await conexion.query(
      `SELECT PerfilId FROM perfilpsicologo WHERE PerfilId = ? AND EstaVerificado = 1 LIMIT 1`,
      [perfilPsicologoId],
    ) as Fila[];
    if (!ps) return { error: "Psicólogo no encontrado.", status: 404 };
    await conexion.execute(
      `INSERT IGNORE INTO empresafavoritos (FavoritoId, PerfileId, PerfilPsicologoId, CreadoEn) VALUES (?, ?, ?, NOW())`,
      [crypto.randomUUID(), emp.perfilId, perfilPsicologoId],
    );
    return { ok: true };
  },

  async quitarFavorito(usuarioId: string, perfilPsicologoId: string): Promise<Resultado<{ ok: true }>> {
    const emp = await empresaDe(usuarioId);
    if (!emp) return SIN_PERFIL;
    await conexion.execute(
      `DELETE FROM empresafavoritos WHERE PerfileId = ? AND PerfilPsicologoId = ?`,
      [emp.perfilId, perfilPsicologoId],
    );
    return { ok: true };
  },
};
