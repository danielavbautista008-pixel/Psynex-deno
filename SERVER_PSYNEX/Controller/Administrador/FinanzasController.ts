import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { transferirPagoSchema } from "../../Validators/Administrador/ConfiguracionValidator.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";
import { FinanzasModel } from "../../Model/Administrador/FinanzasModel.ts";

export const FinanzasController = {
  async resumen(ctx: Context) {
    try {
      const resumen = await FinanzasModel.resumen();
      ctx.response.body = { ok: true, resumen };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener resumen financiero" };
    }
  },

  async listar(ctx: Context) {
    try {
      const pagina = Number(ctx.request.url.searchParams.get("pagina") ?? 1);
      const porPagina = Number(ctx.request.url.searchParams.get("porPagina") ?? 20);
      const data = await FinanzasModel.listar(pagina, porPagina);
      ctx.response.body = { ok: true, ...data };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar pagos" };
    }
  },

  // GET /api/admin/finanzas/panel — datos de la vista Finanzas (mes actual)
  async panel(ctx: Context) {
    try {
      const panel = await FinanzasModel.panel();
      ctx.response.body = { ok: true, panel };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener el panel de finanzas" };
    }
  },

  // GET /api/admin/finanzas/transferencias — lo que se debe a cada psicólogo
  async transferenciasPendientes(ctx: Context) {
    try {
      const psicologos = await FinanzasModel.transferenciasPendientes();
      ctx.response.body = { ok: true, psicologos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener las transferencias pendientes");
    }
  },

  // PATCH /api/admin/finanzas/pagos/:id/transferir  { comprobante? }
  async transferirPago(ctx: RouterContext<string>) {
    const v = transferirPagoSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const n = await FinanzasModel.marcarTransferido({ pagoId: ctx.params.id }, v.data.comprobante);
      if (!n) return responderError(ctx, 404, "Pago no encontrado o ya transferido");
      ctx.response.body = { ok: true, mensaje: "Pago marcado como transferido" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al marcar la transferencia");
    }
  },

  // PATCH /api/admin/finanzas/psicologos/:perfilId/transferir  { comprobante? }
  async transferirPsicologo(ctx: RouterContext<string>) {
    const v = transferirPagoSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const n = await FinanzasModel.marcarTransferido({ perfilId: ctx.params.perfilId }, v.data.comprobante);
      if (!n) return responderError(ctx, 404, "Ese psicólogo no tiene pagos pendientes");
      ctx.response.body = { ok: true, mensaje: `${n} pago(s) marcados como transferidos` };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al marcar las transferencias");
    }
  },

  // PATCH /api/admin/finanzas/cuentas/:id/verificar
  async verificarCuenta(ctx: RouterContext<string>) {
    try {
      const ok = await FinanzasModel.verificarCuenta(ctx.params.id ?? "");
      if (!ok) return responderError(ctx, 404, "Cuenta no encontrada");
      ctx.response.body = { ok: true, mensaje: "Cuenta verificada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al verificar la cuenta");
    }
  },
};