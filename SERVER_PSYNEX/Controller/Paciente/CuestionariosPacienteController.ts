// =====================================================================
// cambio: ARCHIVO NUEVO — GET /api/paciente/cuestionarios-asignados
//   y el historial de resultados (más abajo)
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { CuestionariosPacienteModel, ResultadosPacienteModel } from "../../Model/Paciente/CuestionariosPacienteModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";

export const CuestionariosPacienteController = {
  async asignados(ctx: Context) {
    try {
      const asignaciones = await CuestionariosPacienteModel.asignados(String(ctx.state.usuario?.id ?? ""));
      ctx.response.body = {
        ok: true,
        total: asignaciones.length,
        pendientes: asignaciones.filter((a) => a.estado === "Pendiente").length,
        asignaciones,
      };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar los cuestionarios asignados");
    }
  },
};

// =====================================================================
// cambio: historial de resultados del paciente
//   GET /api/paciente/resultados
//   GET /api/paciente/resultados/:id
// =====================================================================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ResultadosPacienteController = {
  async listar(ctx: Context) {
    try {
      const resultados = await ResultadosPacienteModel.listar(String(ctx.state.usuario?.id ?? ""));
      ctx.response.body = { ok: true, total: resultados.length, resultados };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar tus resultados");
    }
  },

  async detalle(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Resultado no encontrado");
    try {
      const resultado = await ResultadosPacienteModel.detalle(String(ctx.state.usuario?.id ?? ""), id);
      if (!resultado) return responderError(ctx, 404, "Resultado no encontrado");
      ctx.response.body = { ok: true, resultado };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el resultado");
    }
  },
};
