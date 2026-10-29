// =====================================================================
// cambio: ARCHIVO NUEVO — GET /api/admin/pendientes (campanita del admin)
// =====================================================================
import type { Context } from "../../Dependencies/dependencias.ts";
import { PendientesAdminModel } from "../../Model/Administrador/PendientesAdminModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";

export const PendientesAdminController = {
  async resumen(ctx: Context) {
    try {
      ctx.response.body = { ok: true, ...(await PendientesAdminModel.resumen()) };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al contar las tareas pendientes");
    }
  },
};
