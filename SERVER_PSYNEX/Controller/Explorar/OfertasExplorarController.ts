import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { listarOfertasPublicasSchema } from "../../Validators/Explorar/ExplorarValidator.ts";
import { OfertasExplorarModel } from "../../Model/Explorar/OfertasExplorarModel.ts";
import { erroresZod, responderError } from "../../Helpers/Peticion.ts";

// Si el visitante tiene sesión se usa su id para marcar "ya te postulaste"
const visitante = (ctx: Context) => String(ctx.state.usuario?.id ?? "");

export const OfertasExplorarController = {

  // GET /api/explorar/ofertas?busqueda=&modalidad=
  async listar(ctx: Context) {
    const v = listarOfertasPublicasSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ofertas = await OfertasExplorarModel.listar(visitante(ctx), v.data);
      ctx.response.body = { ok: true, total: ofertas.length, ofertas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar ofertas");
    }
  },

  // GET /api/explorar/ofertas/:id
  async detalle(ctx: RouterContext<string>) {
    try {
      const oferta = await OfertasExplorarModel.detalle(visitante(ctx), ctx.params.id ?? "");
      if (!oferta) return responderError(ctx, 404, "Oferta no encontrada");
      ctx.response.body = { ok: true, oferta };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la oferta");
    }
  },

  // GET /api/explorar/empresas/:id/logo  (devuelve la imagen, no JSON)
  async logo(ctx: RouterContext<string>) {
    try {
      const img = await OfertasExplorarModel.logo(ctx.params.id ?? "");
      if (!img) return responderError(ctx, 404, "Sin logo");
      ctx.response.headers.set("Content-Type", img.mime);
      ctx.response.headers.set("Cache-Control", "public, max-age=3600");
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = img.bytes;
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el logo");
    }
  },
};
