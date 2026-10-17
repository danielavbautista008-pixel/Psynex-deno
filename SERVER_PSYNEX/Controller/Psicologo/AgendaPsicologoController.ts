import type { Context } from "../../Dependencies/dependencias.ts";
import {
  citasDelMesSchema,
  configuracionAgendaSchema,
} from "../../Validators/Psicologo/AgendaPsicologoValidator.ts";
import { AgendaPsicologoModel } from "../../Model/Psicologo/AgendaPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);

// Mes actual en Colombia, AAAA-MM
const mesActual = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);

export const AgendaPsicologoController = {

  // GET /api/psicologo/agenda?mes=2026-10
  async citasDelMes(ctx: Context) {
    const v = citasDelMesSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    const mes = v.data.mes ?? mesActual();
    try {
      const citas = await AgendaPsicologoModel.citasDelMes(perfilId(ctx), mes);
      ctx.response.body = { ok: true, mes, total: citas.length, citas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la agenda");
    }
  },

  // GET /api/psicologo/agenda/configuracion
  async obtenerConfiguracion(ctx: Context) {
    try {
      const configuracion = await AgendaPsicologoModel.obtenerConfiguracion(perfilId(ctx));
      ctx.response.body = { ok: true, configuracion };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la configuración");
    }
  },

  // PUT /api/psicologo/agenda/configuracion
  async guardarConfiguracion(ctx: Context) {
    const v = configuracionAgendaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await AgendaPsicologoModel.guardarConfiguracion(perfilId(ctx), v.data);
      ctx.response.body = { ok: true, mensaje: "Disponibilidad guardada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la configuración");
    }
  },
};
