// =====================================================================
// cambio: ARCHIVO NUEVO — la empresa ve las postulaciones a sus ofertas
// (respuestas del formulario y documentos). Solo lectura.
//   GET /api/empresa/postulaciones
//   GET /api/empresa/postulaciones/documentos/:id   (abre el archivo)
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { PostulacionesEmpresaModel } from "../../Model/Empresa/PostulacionesEmpresaModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";
import { leerArchivoSubido } from "../../Helpers/Archivos.ts";

const usuarioId = (ctx: Context) => String(ctx.state.usuario?.id ?? "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PostulacionesEmpresaController = {
  async listar(ctx: Context) {
    try {
      const postulaciones = await PostulacionesEmpresaModel.listar(usuarioId(ctx));
      ctx.response.body = { ok: true, total: postulaciones.length, postulaciones };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar las postulaciones");
    }
  },

  async documento(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Documento no encontrado");
    try {
      const doc = await PostulacionesEmpresaModel.documento(usuarioId(ctx), id);
      const bytes = doc ? await leerArchivoSubido(doc.ruta) : null;
      if (!doc || !bytes) return responderError(ctx, 404, "Documento no encontrado");
      ctx.response.headers.set("Content-Type", doc.mime || "application/pdf");
      ctx.response.headers.set(
        "Content-Disposition",
        `inline; filename="${doc.nombre.replace(/[^\w.\- ]/g, "_")}"`,
      );
      ctx.response.headers.set("Cache-Control", "private, no-store");
      ctx.response.body = bytes;
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al abrir el documento");
    }
  },
};
