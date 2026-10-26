// =====================================================================
// cambio: ARCHIVO NUEVO — Beneficio de la empresa (lado del paciente)
//   GET    /api/paciente/beneficio                  estado del beneficio
//   POST   /api/paciente/beneficio  { codigo }      activar el código
//   DELETE /api/paciente/beneficio                  quitar (si no usó sesiones)
//   POST   /api/pagos/cita/:citaId/usar-beneficio   pagar la cita con el beneficio
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { BeneficioPacienteModel } from "../../Model/Paciente/BeneficioPacienteModel.ts";
import { leerBody, responderError } from "../../Helpers/Peticion.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usuarioDe = (ctx: Context) => String(ctx.state.usuario?.id ?? "");
const esError = (r: unknown): r is { error: string; status: number } =>
  typeof r === "object" && r !== null && "error" in r;

export const BeneficioPacienteController = {
  async estado(ctx: Context) {
    try {
      ctx.response.body = { ok: true, beneficio: await BeneficioPacienteModel.estado(usuarioDe(ctx)) };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al consultar tu beneficio");
    }
  },

  async activar(ctx: Context) {
    const body = await leerBody(ctx) as { codigo?: unknown } | null;
    const codigo = String(body?.codigo ?? "");
    try {
      const r = await BeneficioPacienteModel.activar(usuarioDe(ctx), codigo);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, beneficio: r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo activar el código");
    }
  },

  async quitar(ctx: Context) {
    try {
      const r = await BeneficioPacienteModel.quitar(usuarioDe(ctx));
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo quitar el código");
    }
  },

  async usarEnCita(ctx: RouterContext<string>) {
    const citaId = ctx.params.citaId ?? "";
    if (!UUID.test(citaId)) return responderError(ctx, 404, "Cita no encontrada");
    try {
      const r = await BeneficioPacienteModel.usarEnCita(usuarioDe(ctx), citaId);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, ...r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo usar tu beneficio");
    }
  },
};
