import { conexion } from "../conexion.ts";
import type { ListarOfertasPublicasQuery } from "../../Validators/Explorar/ExplorarValidator.ts";
import { decodificarDataUrl } from "./PsicologosExplorarModel.ts";

type Fila = Record<string, unknown>;

// Columnas de una oferta pública. El "?" de YaPostulado es el UsuarioId
// del visitante ("" si no tiene sesión, así nunca coincide).
const SELECT_OFERTA = `
  SELECT o.OfertaId, o.Titulo, o.Descripcion, o.Requisitos, o.Salario, o.Modalidad,
         o.Estado, o.FechaPublicacion,
         pe.PerfileId AS EmpresaId, pe.NombreEmpresa, pe.Sector, pe.Direccion AS Ubicacion,
         pe.SitioWeb, pe.Descripcion AS EmpresaDescripcion,
         (pe.Logo LIKE 'data:image/%') AS TieneLogo,
         EXISTS (SELECT 1 FROM postulaciones po
                  WHERE po.OfertaId = o.OfertaId AND po.UsuarioId = ?) AS YaPostulado
  FROM ofertaslaborales o
  JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
`;

// Texto con saltos de línea, viñetas o ";" -> lista de frases
function aLista(texto: unknown): string[] {
  return String(texto ?? "")
    .split(/\r?\n|;|•/)
    .map((s) => s.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((s) => s.length > 1);
}

function armarOferta(f: Fila) {
  return {
    id: String(f.OfertaId),
    cargo: String(f.Titulo),
    descripcion: String(f.Descripcion ?? ""),
    requisitos: aLista(f.Requisitos),
    salario: f.Salario === null || f.Salario === undefined ? null : Number(f.Salario),
    modalidad: String(f.Modalidad ?? ""),
    estado: String(f.Estado ?? ""),
    fechaPublicacion: f.FechaPublicacion,
    empresaId: String(f.EmpresaId),
    empresa: String(f.NombreEmpresa ?? ""),
    sector: String(f.Sector ?? ""),
    ubicacion: String(f.Ubicacion ?? ""),
    sitioWeb: String(f.SitioWeb ?? ""),
    empresaDescripcion: String(f.EmpresaDescripcion ?? ""),
    // El logo se pide aparte: /api/explorar/empresas/:empresaId/logo
    tieneLogo: Number(f.TieneLogo ?? 0) === 1,
    yaPostulado: Number(f.YaPostulado ?? 0) === 1,
  };
}

export const OfertasExplorarModel = {

  // Solo ofertas activas de empresas verificadas
  async listar(usuarioId: string, f: ListarOfertasPublicasQuery, limite = 200) {
    const condiciones = ["o.Estado = 'Activa'", "pe.EstaVerificada = 1"];
    const params: (string | number)[] = [usuarioId];
    if (f.modalidad !== "todas") {
      condiciones.push("o.Modalidad = ?");
      params.push(f.modalidad);
    }
    if (f.busqueda) {
      condiciones.push("(o.Titulo LIKE ? OR o.Descripcion LIKE ? OR pe.NombreEmpresa LIKE ?)");
      const like = `%${f.busqueda}%`;
      params.push(like, like, like);
    }
    const filas = await conexion.query(
      `${SELECT_OFERTA} WHERE ${condiciones.join(" AND ")}
       ORDER BY o.FechaPublicacion DESC LIMIT ?`,
      [...params, limite],
    ) as Fila[];
    return filas.map(armarOferta);
  },

  // Detalle (también se puede ver si ya está cerrada, para que el link no se rompa)
  async detalle(usuarioId: string, ofertaId: string) {
    const [fila] = await conexion.query(
      `${SELECT_OFERTA} WHERE o.OfertaId = ? AND pe.EstaVerificada = 1 LIMIT 1`,
      [usuarioId, ofertaId],
    ) as Fila[];
    return fila ? armarOferta(fila) : null;
  },

  async logo(empresaId: string) {
    const [fila] = await conexion.query(
      `SELECT Logo FROM perfilempresa WHERE PerfileId = ? AND EstaVerificada = 1 LIMIT 1`,
      [empresaId],
    ) as Fila[];
    return decodificarDataUrl(fila?.Logo);
  },
};
