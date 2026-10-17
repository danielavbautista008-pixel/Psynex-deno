import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  comisionSchema,
  recompensaPeriodoSchema,
  periodoParamsSchema,
  responderReclamoSchema,
  listarReclamosSchema,
} from "../../Validators/Administrador/ConfiguracionValidator.ts";
import { ConfiguracionModel } from "../../Model/Administrador/ConfiguracionModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

const adminId = (ctx: Context) => String(ctx.state.usuarioId ?? ctx.state.usuario?.id);

export const ConfiguracionController = {

  // GET /api/admin/configuracion
  async listar(ctx: Context) {
    try {
      const configuracion = await ConfiguracionModel.listar();
      ctx.response.body = { ok: true, configuracion };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la configuración");
    }
  },

  // PATCH /api/admin/configuracion/comision  { porcentaje }
  async actualizarComision(ctx: Context) {
    const v = comisionSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await ConfiguracionModel.actualizarComision(v.data.porcentaje);
      ctx.response.body = { ok: true, mensaje: `Comisión actualizada a ${v.data.porcentaje}%` };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar la comisión");
    }
  },

  // GET /api/admin/recompensas
  async listarRecompensas(ctx: Context) {
    try {
      const periodos = await ConfiguracionModel.listarRecompensas();
      ctx.response.body = { ok: true, periodos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar recompensas");
    }
  },

  // PUT /api/admin/recompensas/:anio/:mes  { cupoCitas, valorPorCita }
  async guardarRecompensa(ctx: RouterContext<string>) {
    const p = periodoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    const v = recompensaPeriodoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await ConfiguracionModel.guardarRecompensa(
        p.data.anio, p.data.mes, v.data.cupoCitas, v.data.valorPorCita, adminId(ctx),
      );
      if ("error" in r) return responderError(ctx, 409, r.error ?? "No se pudo guardar");
      ctx.response.body = { ok: true, mensaje: "Tope del mes guardado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar el tope del mes");
    }
  },

  // GET /api/admin/reclamos?estado=
  async listarReclamos(ctx: Context) {
    const v = listarReclamosSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const reclamos = await ConfiguracionModel.listarReclamos(v.data.estado);
      ctx.response.body = { ok: true, total: reclamos.length, reclamos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar reclamos");
    }
  },

  // PATCH /api/admin/reclamos/:id  { estado, respuesta? }
  async responderReclamo(ctx: RouterContext<string>) {
    const v = responderReclamoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await ConfiguracionModel.responderReclamo(
        ctx.params.id ?? "", v.data.estado, v.data.respuesta, adminId(ctx),
      );
      if (!ok) return responderError(ctx, 404, "Reclamo no encontrado");
      ctx.response.body = { ok: true, mensaje: "Reclamo actualizado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al responder el reclamo");
    }
  },
};
