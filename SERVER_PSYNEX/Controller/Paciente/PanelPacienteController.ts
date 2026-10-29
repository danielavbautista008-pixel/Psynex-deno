// =====================================================================
// cambio: ARCHIVO NUEVO — panel del paciente
//   GET   /api/paciente/inicio                         datos de la pantalla de Inicio
//   GET   /api/paciente/registro-emocional             registros del último año
//   PUT   /api/paciente/registro-emocional             guardar el registro de hoy
//   PATCH /api/paciente/citas/:citaId/cancelar         { motivo }
//   POST  /api/paciente/citas/:citaId/calificacion     { puntaje, comentario }
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { InicioPacienteModel } from "../../Model/Paciente/InicioPacienteModel.ts";
import { RegistroEmocionalModel } from "../../Model/Paciente/RegistroEmocionalModel.ts";
import { CitasPacienteModel } from "../../Model/Paciente/CitasPacienteModel.ts";
import {
  calificarCitaSchema,
  cancelarCitaSchema,
  registroEmocionalSchema,
} from "../../Validators/Paciente/PacienteValidator.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usuarioDe = (ctx: Context) => String(ctx.state.usuario?.id ?? "");
const esError = (r: unknown): r is { error: string; status: number } =>
  typeof r === "object" && r !== null && "error" in r;

// Si falta ejecutar registro_emocional.sql, MariaDB responde "Unknown column"
const faltaColumna = (e: unknown) => /Unknown column/i.test(String((e as Error)?.message ?? e));

export const PanelPacienteController = {
  async inicio(ctx: Context) {
    try {
      const datos = await InicioPacienteModel.resumen(usuarioDe(ctx));
      if (!datos) return responderError(ctx, 404, "No encontramos tu cuenta");
      ctx.response.body = { ok: true, ...datos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al cargar tu inicio");
    }
  },

  async registros(ctx: Context) {
    try {
      const registros = await RegistroEmocionalModel.listar(usuarioDe(ctx));
      ctx.response.body = { ok: true, registros };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, faltaColumna(e)
        ? "Falta actualizar la base de datos del registro emocional"
        : "Error al cargar tus registros");
    }
  },

  async guardarRegistro(ctx: Context) {
    const body = await leerBody(ctx);
    const v = registroEmocionalSchema.safeParse(body ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const registro = await RegistroEmocionalModel.guardarHoy(usuarioDe(ctx), v.data);
      ctx.response.body = { ok: true, registro };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, faltaColumna(e)
        ? "Falta actualizar la base de datos del registro emocional"
        : "No se pudo guardar tu registro");
    }
  },

  async cancelarCita(ctx: RouterContext<string>) {
    const citaId = ctx.params.citaId ?? "";
    if (!UUID.test(citaId)) return responderError(ctx, 404, "Cita no encontrada");
    const v = cancelarCitaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await CitasPacienteModel.cancelar(usuarioDe(ctx), citaId, v.data.motivo);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, ...r };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo cancelar la cita");
    }
  },

  async calificarCita(ctx: RouterContext<string>) {
    const citaId = ctx.params.citaId ?? "";
    if (!UUID.test(citaId)) return responderError(ctx, 404, "Cita no encontrada");
    const v = calificarCitaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await CitasPacienteModel.calificar(usuarioDe(ctx), citaId, v.data.puntaje, v.data.comentario);
      if (esError(r)) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo guardar tu reseña");
    }
  },
};
