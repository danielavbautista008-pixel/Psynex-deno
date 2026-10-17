import type { Context, RouterContext } from "../Dependencies/dependencias.ts";
import { listarNotificacionesSchema } from "../Validators/NotificacionesValidator.ts";
import { NotificacionesModel } from "../Model/NotificacionesModel.ts";
import { erroresZod, responderError } from "../Helpers/Peticion.ts";

const usuarioId = (ctx: Context) => String(ctx.state.usuarioId ?? ctx.state.usuario?.id);

export const NotificacionesController = {

  // GET /api/notificaciones?soloNoLeidas=true&limite=30
  async listar(ctx: Context) {
    const v = listarNotificacionesSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const datos = await NotificacionesModel.listar(usuarioId(ctx), v.data);
      ctx.response.body = { ok: true, ...datos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar notificaciones");
    }
  },

  // PATCH /api/notificaciones/:id/leida
  async marcarLeida(ctx: RouterContext<string>) {
    try {
      const ok = await NotificacionesModel.marcarLeida(usuarioId(ctx), ctx.params.id ?? "");
      if (!ok) return responderError(ctx, 404, "Notificación no encontrada");
      ctx.response.body = { ok: true };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar la notificación");
    }
  },

  // PATCH /api/notificaciones/leer-todas
  async marcarTodasLeidas(ctx: Context) {
    try {
      const n = await NotificacionesModel.marcarTodasLeidas(usuarioId(ctx));
      ctx.response.body = { ok: true, actualizadas: n };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar las notificaciones");
    }
  },
};
