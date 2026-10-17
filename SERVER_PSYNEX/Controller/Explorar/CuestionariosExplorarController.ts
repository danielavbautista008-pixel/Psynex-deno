import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarCuestionariosSchema,
  responderCuestionarioSchema,
} from "../../Validators/Explorar/ExplorarValidator.ts";
import { CuestionariosExplorarModel } from "../../Model/Explorar/CuestionariosExplorarModel.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";
import { leerArchivoSubido, mimeDeRuta } from "../../Helpers/Archivos.ts";

export const CuestionariosExplorarController = {

  // GET /api/explorar/cuestionarios?categoriaId=
  async listar(ctx: Context) {
    const v = listarCuestionariosSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const [cuestionarios, categorias] = await Promise.all([
        CuestionariosExplorarModel.listar(v.data.categoriaId),
        CuestionariosExplorarModel.categorias(),
      ]);
      ctx.response.body = { ok: true, total: cuestionarios.length, cuestionarios, categorias };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar cuestionarios");
    }
  },

  // GET /api/explorar/cuestionarios/:id
  async detalle(ctx: RouterContext<string>) {
    try {
      const cuestionario = await CuestionariosExplorarModel.detalle(ctx.params.id ?? "");
      if (!cuestionario) return responderError(ctx, 404, "Cuestionario no encontrado");
      ctx.response.body = { ok: true, cuestionario };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el cuestionario");
    }
  },

  // POST /api/explorar/cuestionarios/:id/resultado
  // Público: cualquiera ve su resultado. Solo se guarda si es un paciente con sesión.
  async resolver(ctx: RouterContext<string>) {
    const v = responderCuestionarioSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await CuestionariosExplorarModel.resolver(ctx.params.id ?? "", v.data, ctx.state.usuario);
      if ("error" in r) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo calcular");
      ctx.response.body = { ok: true, resultado: r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al calcular el resultado");
    }
  },

  // GET /api/explorar/cuestionarios/:id/imagen  (devuelve la imagen, no JSON)
  async imagen(ctx: RouterContext<string>) {
    try {
      const ruta = await CuestionariosExplorarModel.rutaImagen(ctx.params.id ?? "");
      const bytes = ruta ? await leerArchivoSubido(ruta) : null;
      if (!ruta || !bytes) return responderError(ctx, 404, "Sin imagen");
      // Cada foto nueva se guarda con otro nombre, así que el nombre sirve de
      // "versión" (ETag). Con no-cache el navegador pregunta siempre: si la foto
      // no cambió recibe un 304 (sin descargarla otra vez); si cambió, la nueva.
      const etag = `"${ruta.split("/").pop()}"`;
      ctx.response.headers.set("ETag", etag);
      ctx.response.headers.set("Cache-Control", "public, no-cache");
      if (ctx.request.headers.get("If-None-Match") === etag) {
        ctx.response.status = 304;
        return;
      }
      ctx.response.headers.set("Content-Type", mimeDeRuta(ruta));
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = bytes;
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la imagen");
    }
  },
};
