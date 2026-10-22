import type { Context } from "../../Dependencies/dependencias.ts";
import {
  actualizarPerfilSchema,
  especialidadesSchema,
} from "../../Validators/Psicologo/PerfilPsicologoValidator.ts";
import { PerfilPsicologoModel } from "../../Model/Psicologo/PerfilPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

// ctx.state.perfilPsicologo lo deja listo el middleware requierePerfilPsicologo
const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);

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
};
