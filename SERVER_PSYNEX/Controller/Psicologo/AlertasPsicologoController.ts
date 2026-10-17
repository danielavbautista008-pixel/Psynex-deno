import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarAlertasSchema,
  atenderAlertaSchema,
} from "../../Validators/Psicologo/AlertasPsicologoValidator.ts";
import { AlertasPsicologoModel } from "../../Model/Psicologo/AlertasPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);

export const AlertasPsicologoController = {

  // GET /api/psicologo/alertas?estado=todas|pendientes|atendidas
  async listar(ctx: Context) {
    const v = listarAlertasSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const datos = await AlertasPsicologoModel.listar(perfilId(ctx), v.data);
      ctx.response.body = { ok: true, ...datos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar alertas");
    }
  },

  // GET /api/psicologo/alertas/:id
  async detalle(ctx: RouterContext<string>) {
    try {
      const alerta = await AlertasPsicologoModel.buscarPorId(perfilId(ctx), ctx.params.id ?? "");
      if (!alerta) return responderError(ctx, 404, "Alerta no encontrada");
      ctx.response.body = { ok: true, alerta };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la alerta");
    }
  },

  // PATCH /api/psicologo/alertas/:id/atender  { accion? }
  async atender(ctx: RouterContext<string>) {
    const v = atenderAlertaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await AlertasPsicologoModel.atender(perfilId(ctx), ctx.params.id ?? "", v.data.accion);
      if (!ok) return responderError(ctx, 404, "Alerta no encontrada");
      ctx.response.body = { ok: true, mensaje: "Alerta marcada como atendida" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al atender la alerta");
    }
  },
};
