import { Context, Status } from "../../Dependencies/dependencias.ts";
import { EstadisticasModel } from "../../Model/Administrador/Estadisticasmodel.ts";
import { filtroEstadisticasSchema } from "../../Validators/Administrador/EstadisticasValidator.ts";

export const EstadisticasController = {
  // GET /estadisticas?meses=6 — solo Admin.
  // Devuelve las tarjetas (kpis), citasPorMes, citasPorTipo e ingresosPorFuente.
  async obtener(ctx: Context) {
    const params = Object.fromEntries(ctx.request.url.searchParams);
    const parsed = filtroEstadisticasSchema.safeParse(params);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const datos = await EstadisticasModel.obtener(parsed.data.meses);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, ...datos };
  },
};