import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { listarOfertasSchema, postularSchema } from "../../Validators/Psicologo/OfertasPsicologoValidator.ts";
import { OfertasPsicologoModel } from "../../Model/Psicologo/OfertasPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";
import { guardarArchivo, validarArchivo } from "../../Helpers/Archivos.ts";

const perfil = (ctx: Context) => ctx.state.perfilPsicologo;

export const OfertasPsicologoController = {

  // GET /api/psicologo/ofertas?busqueda=&modalidad=&pagina=
  async listar(ctx: Context) {
    const v = listarOfertasSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const { ofertas, total } = await OfertasPsicologoModel.listar(String(perfil(ctx).UsuarioId), v.data);
      ctx.response.body = { ok: true, total, pagina: v.data.pagina, porPagina: v.data.porPagina, ofertas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar ofertas");
    }
  },

  // GET /api/psicologo/ofertas/:id
  async detalle(ctx: RouterContext<string>) {
    try {
      const oferta = await OfertasPsicologoModel.buscarPorId(String(perfil(ctx).UsuarioId), ctx.params.id ?? "");
      if (!oferta) return responderError(ctx, 404, "Oferta no encontrada");
      ctx.response.body = { ok: true, oferta };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la oferta");
    }
  },

  // POST /api/psicologo/ofertas/:id/postular
  // Acepta JSON, o multipart/form-data si además se adjunta la hoja de vida
  // (campo "hojaVida", solo PDF, máximo 5 MB).
  async postular(ctx: RouterContext<string>) {
    // Solo los psicólogos verificados pueden postularse
    if (!Number(perfil(ctx).EstaVerificado)) {
      return responderError(ctx, 403, "Tu perfil debe estar verificado para postularte");
    }

    let datos: unknown = null;
    let hojaVida: File | null = null;
    if (ctx.request.body.type() === "form-data") {
      try {
        const form = await ctx.request.body.formData();
        const campos: Record<string, string> = {};
        for (const [clave, valor] of form.entries()) {
          if (typeof valor === "string") campos[clave] = valor;
        }
        datos = campos;
        const archivo = form.get("hojaVida");
        if (archivo instanceof File && archivo.size > 0) hojaVida = archivo;
      } catch {
        return responderError(ctx, 400, "No se pudo leer el formulario");
      }
    } else {
      datos = await leerBody(ctx);
    }

    const v = postularSchema.safeParse(datos);
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));

    const usuarioId = String(perfil(ctx).UsuarioId);
    let documento: { ruta: string; nombre: string; bytes: number } | null = null;
    if (hojaVida) {
      const r = await validarArchivo(hojaVida, "Hoja de vida");
      if (!r.ok) return responderError(ctx, 400, r.error);
      if (r.valor.ext !== "pdf") return responderError(ctx, 400, "La hoja de vida debe ser un PDF");
      const ruta = await guardarArchivo("hojas-vida", usuarioId, hojaVida, "pdf");
      documento = { ruta, nombre: hojaVida.name.slice(0, 200), bytes: hojaVida.size };
    }

    try {
      const r = await OfertasPsicologoModel.postular(
        usuarioId, String(perfil(ctx).NombreCompleto), ctx.params.id ?? "", v.data, documento,
      );
      if ("error" in r) {
        if (documento) await Deno.remove(documento.ruta).catch(() => {});
        return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo postular");
      }
      ctx.response.status = 201;
      ctx.response.body = { ok: true, postulacionId: r.postulacionId };
    } catch (e) {
      console.error(e);
      if (documento) await Deno.remove(documento.ruta).catch(() => {});
      responderError(ctx, 500, "Error al registrar la postulación");
    }
  },

  // GET /api/psicologo/postulaciones
  async misPostulaciones(ctx: Context) {
    try {
      const postulaciones = await OfertasPsicologoModel.misPostulaciones(String(perfil(ctx).UsuarioId));
      ctx.response.body = { ok: true, postulaciones };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar postulaciones");
    }
  },
};
