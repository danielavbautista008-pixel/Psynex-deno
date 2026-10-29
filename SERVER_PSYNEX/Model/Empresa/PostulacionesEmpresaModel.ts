// =====================================================================
// cambio: ARCHIVO NUEVO — la empresa ve el detalle de las postulaciones
// a SUS ofertas (solo lectura: no cambia nada en la base de datos).
// Tablas: postulaciones, ofertaslaborales, perfilempresa, usuarios,
// perfilpsicologo y documentos.
// =====================================================================
import { conexion } from "../conexion.ts";

type Fila = Record<string, unknown>;

// Documentos que la empresa puede ver del psicólogo que se postuló.
// (La cédula NO se comparte: es un dato personal que solo revisa el admin.)
export const TIPOS_DOCUMENTO_EMPRESA = ["hoja_vida", "tarjeta_profesional", "diploma", "certificado_vigencia"];

const NOMBRE_TIPO: Record<string, string> = {
  hoja_vida: "Hoja de vida",
  tarjeta_profesional: "Tarjeta profesional",
  diploma: "Diploma o título profesional",
  certificado_vigencia: "Certificado de vigencia",
};

const marcas = (n: number) => Array(n).fill("?").join(", ");

export const PostulacionesEmpresaModel = {
  // Todas las postulaciones a las ofertas de la empresa (con respuestas y documentos)
  async listar(empresaUsuarioId: string) {
    const filas = await conexion.query(
      `SELECT po.PostulacionId, po.Estado, po.FechaPostulacion,
              po.Telefono, po.Ciudad, po.Especialidad, po.ExperienciaAnos,
              po.PerfilProfesional, po.CartaPresent,
              o.OfertaId, o.Titulo,
              u.UsuarioId, u.NombreCompleto, u.Email,
              ps.PerfilId,
              (ps.Foto IS NOT NULL AND ps.Foto LIKE 'data:image/%') AS TieneFoto,
              CRC32(ps.Foto) AS FotoVersion
       FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       JOIN usuarios u ON u.UsuarioId = po.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE pe.UsuarioId = ?
       ORDER BY po.FechaPostulacion DESC`,
      [empresaUsuarioId],
    ) as Fila[];

    const usuarios = [...new Set(filas.map((f) => String(f.UsuarioId)))];
    const docs = usuarios.length
      ? await conexion.query(
        `SELECT DocumentoArchivoId, UsuarioId, Tipo, NombreOriginal, Mime, TamanoBytes, CreadoEn
         FROM documentos
         WHERE UsuarioId IN (${marcas(usuarios.length)})
           AND Tipo IN (${marcas(TIPOS_DOCUMENTO_EMPRESA.length)})
         ORDER BY CreadoEn DESC`,
        [...usuarios, ...TIPOS_DOCUMENTO_EMPRESA],
      ) as Fila[]
      : [];

    return filas.map((f) => {
      const fecha = new Date(String(f.FechaPostulacion)).getTime();
      const propios = docs.filter((d) => String(d.UsuarioId) === String(f.UsuarioId));
      // Hoja de vida: la que subió con ESTA postulación (la más reciente hasta ese momento)
      const hoja = propios.find(
        (d) => d.Tipo === "hoja_vida" && new Date(String(d.CreadoEn)).getTime() <= fecha + 2 * 60 * 1000,
      );
      const otros = propios.filter((d) => d.Tipo !== "hoja_vida");
      // De cada tipo, solo el más reciente
      const unicos = otros.filter((d, i) => otros.findIndex((x) => x.Tipo === d.Tipo) === i);
      const documentos = [...(hoja ? [hoja] : []), ...unicos].map((d) => ({
        id: String(d.DocumentoArchivoId),
        tipo: String(d.Tipo),
        nombre: NOMBRE_TIPO[String(d.Tipo)] ?? String(d.Tipo),
        archivo: String(d.NombreOriginal ?? ""),
        mime: String(d.Mime ?? ""),
        bytes: Number(d.TamanoBytes ?? 0),
      }));

      return {
        id: String(f.PostulacionId),
        estado: String(f.Estado ?? "Pendiente"),
        fecha: f.FechaPostulacion,
        oferta: { id: String(f.OfertaId), titulo: String(f.Titulo ?? "") },
        psicologo: {
          usuarioId: String(f.UsuarioId),
          perfilId: f.PerfilId ? String(f.PerfilId) : null,
          nombre: String(f.NombreCompleto ?? ""),
          email: String(f.Email ?? ""),
          tieneFoto: Number(f.TieneFoto ?? 0) === 1,
          fotoVersion: String(f.FotoVersion ?? ""),
        },
        respuestas: {
          telefono: String(f.Telefono ?? ""),
          ciudad: String(f.Ciudad ?? ""),
          especialidad: String(f.Especialidad ?? ""),
          experienciaAnos: f.ExperienciaAnos === null || f.ExperienciaAnos === undefined ? null : Number(f.ExperienciaAnos),
          perfilProfesional: String(f.PerfilProfesional ?? ""),
          cartaPresentacion: String(f.CartaPresent ?? ""),
        },
        documentos,
      };
    });
  },

  // Un documento SOLO si su dueño se postuló a alguna oferta de esta empresa
  async documento(empresaUsuarioId: string, documentoId: string) {
    const [d] = await conexion.query(
      `SELECT d.RutaArchivo, d.Mime, d.NombreOriginal
       FROM documentos d
       WHERE d.DocumentoArchivoId = ?
         AND d.Tipo IN (${marcas(TIPOS_DOCUMENTO_EMPRESA.length)})
         AND EXISTS (
           SELECT 1 FROM postulaciones po
           JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
           JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
           WHERE po.UsuarioId = d.UsuarioId AND pe.UsuarioId = ?)
       LIMIT 1`,
      [documentoId, ...TIPOS_DOCUMENTO_EMPRESA, empresaUsuarioId],
    ) as Fila[];
    return d
      ? { ruta: String(d.RutaArchivo), mime: String(d.Mime ?? "application/pdf"), nombre: String(d.NombreOriginal ?? "documento") }
      : null;
  },
};
