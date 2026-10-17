import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  asignarCuestionarioSchema,
  listarAsignacionesSchema,
} from "../../Validators/Psicologo/CuestionariosPsicologoValidator.ts";
import { CuestionariosPsicologoModel } from "../../Model/Psicologo/CuestionariosPsicologoModel.ts";
import { esPacienteDelPsicologo } from "../../Helpers/PsicologoAuth.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

const perfil = (ctx: Context) => ctx.state.perfilPsicologo;

export const CuestionariosPsicologoController = {

  // GET /api/psicologo/cuestionarios — catálogo + categorías con cantidad
  async catalogo(ctx: Context) {
    try {
      const datos = await CuestionariosPsicologoModel.catalogo();
      ctx.response.body = { ok: true, ...datos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar cuestionarios");
    }
  },

  // GET /api/psicologo/cuestionarios/asignaciones?estado=&pacienteId=
  async listarAsignaciones(ctx: Context) {
    const v = listarAsignacionesSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const asignaciones = await CuestionariosPsicologoModel.listarAsignaciones(
        String(perfil(ctx).UsuarioId), v.data,
      );
      ctx.response.body = { ok: true, total: asignaciones.length, asignaciones };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar asignaciones");
    }
  },

  // POST /api/psicologo/cuestionarios/asignaciones
  async asignar(ctx: Context) {
    const v = asignarCuestionarioSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      // Solo puede asignar cuestionarios a SUS pacientes
      if (!(await esPacienteDelPsicologo(String(perfil(ctx).PerfilId), v.data.pacienteId))) {
        return responderError(ctx, 404, "Paciente no encontrado");
      }
      const r = await CuestionariosPsicologoModel.asignar(
        String(perfil(ctx).UsuarioId), String(perfil(ctx).NombreCompleto), v.data,
      );
      if ("error" in r) return responderError(ctx, 409, r.error ?? "No se pudo asignar");
      ctx.response.status = 201;
      ctx.response.body = { ok: true, asignacionId: r.asignacionId };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al asignar el cuestionario");
    }
  },

  // DELETE /api/psicologo/cuestionarios/asignaciones/:id
  async cancelar(ctx: RouterContext<string>) {
    try {
      const ok = await CuestionariosPsicologoModel.cancelar(String(perfil(ctx).UsuarioId), ctx.params.id ?? "");
      if (!ok) return responderError(ctx, 404, "Asignación no encontrada o ya respondida");
      ctx.response.body = { ok: true, mensaje: "Asignación cancelada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al cancelar la asignación");
    }
  },
};
