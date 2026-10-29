import type { Context } from "../../Dependencies/dependencias.ts";
import { responderImagen } from "../../Helpers/Imagen.ts";
import type { RouterContext } from "../../Dependencies/dependencias.ts";
import {
  actualizarPerfilSchema,
  especialidadesSchema,
  estudioSchema,
  experienciaSchema,
  fotoSchema,
} from "../../Validators/Psicologo/PerfilPsicologoValidator.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";
import { PerfilPsicologoModel } from "../../Model/Psicologo/PerfilPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

// ctx.state.perfilPsicologo lo deja listo el middleware requierePerfilPsicologo
const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Primeros bytes de cada formato: el texto "data:image/png" se puede inventar,
// el contenido real de la imagen no.
const esImagenReal = (b: Uint8Array) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||                       // JPG
  (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||      // PNG
  (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&       // WEBP (RIFF....WEBP)
   b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50);

export const PerfilPsicologoController = {

  // GET /api/psicologo/perfil
  async obtener(ctx: Context) {
    try {
      const perfil = await PerfilPsicologoModel.obtener(perfilId(ctx));
      if (!perfil) return responderError(ctx, 404, "Perfil no encontrado");
      ctx.response.body = { ok: true, perfil };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el perfil");
    }
  },

  // PATCH /api/psicologo/perfil
  async actualizar(ctx: Context) {
    const v = actualizarPerfilSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await PerfilPsicologoModel.actualizar(perfilId(ctx), v.data);
      ctx.response.body = { ok: true, mensaje: "Perfil actualizado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar el perfil");
    }
  },

  // GET /api/psicologo/perfil/especialidades — catálogo para el selector
  async catalogoEspecialidades(ctx: Context) {
    try {
      const especialidades = await PerfilPsicologoModel.catalogoEspecialidades();
      ctx.response.body = { ok: true, especialidades };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar especialidades");
    }
  },

  // PUT /api/psicologo/perfil/especialidades — reemplaza la lista
  async reemplazarEspecialidades(ctx: Context) {
    const v = especialidadesSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await PerfilPsicologoModel.reemplazarEspecialidades(perfilId(ctx), v.data.especialidadIds);
      if (!ok) return responderError(ctx, 400, "Alguna especialidad no existe o está inactiva");
      ctx.response.body = { ok: true, mensaje: "Especialidades actualizadas" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar especialidades");
    }
  },

  // GET /api/psicologo/perfil/foto — devuelve la imagen (no JSON)
  async foto(ctx: Context) {
    try {
      const img = decodificarDataUrl(await PerfilPsicologoModel.foto(perfilId(ctx)));
      if (!img) return responderError(ctx, 404, "Sin foto");
      await responderImagen(ctx, img);
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la foto");
    }
  },

  // PUT /api/psicologo/perfil/foto  { foto: "data:image/jpeg;base64,..." }
  async guardarFoto(ctx: Context) {
    const v = fotoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    const img = decodificarDataUrl(v.data.foto);
    if (!img || !esImagenReal(img.bytes)) return responderError(ctx, 400, "El archivo no es una imagen válida");
    try {
      await PerfilPsicologoModel.guardarFoto(perfilId(ctx), v.data.foto);
      ctx.response.body = { ok: true, mensaje: "Foto actualizada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la foto");
    }
  },

  // POST /api/psicologo/perfil/estudios
  async crearEstudio(ctx: Context) {
    const v = estudioSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const id = await PerfilPsicologoModel.crearEstudio(perfilId(ctx), v.data);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, mensaje: "Estudio agregado", estudioId: id };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar el estudio");
    }
  },

  // PATCH /api/psicologo/perfil/estudios/:id
  async actualizarEstudio(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Estudio no encontrado");
    const v = estudioSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await PerfilPsicologoModel.actualizarEstudio(perfilId(ctx), id, v.data);
      if (!ok) return responderError(ctx, 404, "Estudio no encontrado");
      ctx.response.body = { ok: true, mensaje: "Estudio actualizado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar el estudio");
    }
  },

  // DELETE /api/psicologo/perfil/estudios/:id
  async eliminarEstudio(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Estudio no encontrado");
    try {
      const ok = await PerfilPsicologoModel.eliminarEstudio(perfilId(ctx), id);
      if (!ok) return responderError(ctx, 404, "Estudio no encontrado");
      ctx.response.body = { ok: true, mensaje: "Estudio eliminado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al eliminar el estudio");
    }
  },

  // POST /api/psicologo/perfil/experiencia
  async crearExperiencia(ctx: Context) {
    const v = experienciaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const id = await PerfilPsicologoModel.crearExperiencia(perfilId(ctx), v.data);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, mensaje: "Experiencia agregada", experienciaId: id };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la experiencia");
    }
  },

  // PATCH /api/psicologo/perfil/experiencia/:id
  async actualizarExperiencia(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Experiencia no encontrada");
    const v = experienciaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await PerfilPsicologoModel.actualizarExperiencia(perfilId(ctx), id, v.data);
      if (!ok) return responderError(ctx, 404, "Experiencia no encontrada");
      ctx.response.body = { ok: true, mensaje: "Experiencia actualizada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar la experiencia");
    }
  },

  // DELETE /api/psicologo/perfil/experiencia/:id
  async eliminarExperiencia(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Experiencia no encontrada");
    try {
      const ok = await PerfilPsicologoModel.eliminarExperiencia(perfilId(ctx), id);
      if (!ok) return responderError(ctx, 404, "Experiencia no encontrada");
      ctx.response.body = { ok: true, mensaje: "Experiencia eliminada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al eliminar la experiencia");
    }
  },
};
