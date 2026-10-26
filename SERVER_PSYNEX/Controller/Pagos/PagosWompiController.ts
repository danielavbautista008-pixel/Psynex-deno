// =====================================================================
// cambio: ARCHIVO NUEVO — Pagos del paciente con Wompi
//   GET  /api/paciente/citas                       mis citas reales + estado de pago
//   GET  /api/paciente/paquetes                    mis paquetes activos
//   GET  /api/paciente/pagos                       historial de pagos
//   POST /api/pagos/wompi/cita/:citaId             -> { url } del checkout
//   POST /api/pagos/wompi/plan/:planId             -> { url } del checkout
//   GET  /api/pagos/wompi/confirmar/:transaccionId  al volver de Wompi
//   POST /api/pagos/cita/:citaId/usar-paquete      pagar con una sesión del paquete
//   POST /api/pagos/wompi/eventos                  webhook de Wompi (público, con firma)
//
// cambio: modo manual temporal (sin llaves de prueba de Wompi): el pago queda
// en revisión y el administrador lo acepta en "Pagos de pacientes":
//   GET   /api/admin/pagos-pacientes
//   PATCH /api/admin/pagos-pacientes/:tipo/:id/aprobar     (tipo: cita | paquete)
//   PATCH /api/admin/pagos-pacientes/:tipo/:id/rechazar    { motivo? }
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { PagosWompiModel } from "../../Model/Pagos/PagosWompiModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";
import { eventoValido, modoPago } from "../../Helpers/Wompi.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usuarioDe = (ctx: Context) => String(ctx.state.usuario?.id ?? "");
const esError = (r: unknown): r is { error: string; status: number } =>
  typeof r === "object" && r !== null && "error" in r;

export const PagosWompiController = {
  async citas(ctx: Context) {
    try {
      const citas = await PagosWompiModel.citasPaciente(usuarioDe(ctx));
      ctx.response.body = { ok: true, total: citas.length, modoPago: modoPago(), citas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar tus citas");
    }
  },

  async paquetes(ctx: Context) {
    try {
      const paquetes = await PagosWompiModel.paquetes(usuarioDe(ctx));
      ctx.response.body = { ok: true, total: paquetes.length, modoPago: modoPago(), paquetes };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar tus paquetes");
    }
  },

  async historial(ctx: Context) {
    try {
      const pagos = await PagosWompiModel.historial(usuarioDe(ctx));
      ctx.response.body = { ok: true, total: pagos.length, pagos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar tus pagos");
    }
  },

  async pagarCita(ctx: RouterContext<string>) {
    const citaId = ctx.params.citaId ?? "";
    if (!UUID.test(citaId)) return responderError(ctx, 404, "Cita no encontrada");
    try {
      const r = await PagosWompiModel.pagarCita(usuarioDe(ctx), citaId);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, ...r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo preparar el pago");
    }
  },

  async comprarPlan(ctx: RouterContext<string>) {
    const planId = ctx.params.planId ?? "";
    if (!UUID.test(planId)) return responderError(ctx, 404, "Plan no encontrado");
    try {
      const r = await PagosWompiModel.comprarPlan(usuarioDe(ctx), planId);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, ...r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo preparar la compra");
    }
  },

  async confirmar(ctx: RouterContext<string>) {
    const id = ctx.params.transaccionId ?? "";
    if (!/^[\w-]{5,80}$/.test(id)) return responderError(ctx, 400, "Transacción no válida");
    try {
      const r = await PagosWompiModel.confirmar(id, usuarioDe(ctx));
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, pago: r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo confirmar el pago");
    }
  },

  async usarPaquete(ctx: RouterContext<string>) {
    const citaId = ctx.params.citaId ?? "";
    if (!UUID.test(citaId)) return responderError(ctx, 404, "Cita no encontrada");
    try {
      const r = await PagosWompiModel.usarPaquete(usuarioDe(ctx), citaId);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, ...r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo usar tu paquete");
    }
  },

  // Webhook: Wompi avisa cuando cambia una transacción.
  // Solo se acepta si la firma (checksum) es correcta.
  async eventos(ctx: Context) {
    let evento: Record<string, unknown> = {};
    try {
      evento = await ctx.request.body.json();
    } catch {
      return responderError(ctx, 400, "Evento no válido");
    }
    if (!(await eventoValido(evento))) return responderError(ctx, 401, "Firma del evento no válida");

    const tx = (evento.data as { transaction?: { id?: string } } | undefined)?.transaction;
    if (evento.event === "transaction.updated" && tx?.id) {
      try {
        const r = await PagosWompiModel.confirmar(String(tx.id), null);
        if (esError(r)) console.error("Webhook Wompi:", r.error);
      } catch (e) {
        console.error("Webhook Wompi:", e);
      }
    }
    // Wompi solo necesita un 200 para saber que recibimos el evento
    ctx.response.body = { ok: true };
  },

  // ---------------- Administrador (modo manual temporal) ----------------
  async pendientesAdmin(ctx: Context) {
    try {
      const pagos = await PagosWompiModel.pendientesAdmin();
      ctx.response.body = { ok: true, modoPago: modoPago(), total: pagos.length, pagos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar los pagos de pacientes");
    }
  },

  async aprobarAdmin(ctx: RouterContext<string>) {
    await decidir(ctx, true);
  },

  async rechazarAdmin(ctx: RouterContext<string>) {
    await decidir(ctx, false);
  },
};

async function decidir(ctx: RouterContext<string>, aprobar: boolean) {
  const tipo = ctx.params.tipo ?? "";
  const id = ctx.params.id ?? "";
  if (!UUID.test(id) || (tipo !== "cita" && tipo !== "paquete")) return responderError(ctx, 404, "Pago no encontrado");
  let motivo = "";
  if (!aprobar) {
    try {
      const body = await ctx.request.body.json();
      motivo = String(body?.motivo ?? "").trim().slice(0, 300);
    } catch { /* el motivo es opcional */ }
  }
  try {
    const r = tipo === "cita"
      ? await PagosWompiModel.decidirCitaAdmin(id, aprobar, motivo)
      : await PagosWompiModel.decidirCompraAdmin(id, aprobar, motivo);
    if (esError(r)) return responderError(ctx, r.status, r.error);
    ctx.response.body = { ok: true, ...r };
  } catch (e) {
    console.error(e);
    responderError(ctx, 500, "No se pudo guardar la decisión");
  }
}
