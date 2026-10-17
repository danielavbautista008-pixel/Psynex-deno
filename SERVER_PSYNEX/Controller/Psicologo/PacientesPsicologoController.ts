import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarPacientesSchema,
  notaSchema,
  actualizarNotaSchema,
} from "../../Validators/Psicologo/PacientesPsicologoValidator.ts";
import { PacientesPsicologoModel } from "../../Model/Psicologo/PacientesPsicologoModel.ts";
import { esPacienteDelPsicologo } from "../../Helpers/PsicologoAuth.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";

const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);
const usuarioPsicologoId = (ctx: Context) => String(ctx.state.perfilPsicologo.UsuarioId);

// Valida que el paciente de la URL sea de este psicólogo. Si no, responde 404
// (no 403, para no revelar si ese paciente existe en la plataforma).
async function pacientePermitido(ctx: RouterContext<string>): Promise<string | null> {
  const pacienteId = ctx.params.pacienteId ?? "";
  if (!pacienteId || !(await esPacienteDelPsicologo(perfilId(ctx), pacienteId))) {
    responderError(ctx, 404, "Paciente no encontrado");
    return null;
  }
  return pacienteId;
}

export const PacientesPsicologoController = {

  // GET /api/psicologo/pacientes?busqueda=&estado=
  async listar(ctx: Context) {
    const v = listarPacientesSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const pacientes = await PacientesPsicologoModel.listar(perfilId(ctx), v.data);
      ctx.response.body = { ok: true, total: pacientes.length, pacientes };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar pacientes");
    }
  },

  // GET /api/psicologo/pacientes/:pacienteId — historial completo
  async historial(ctx: RouterContext<string>) {
    try {
      const pacienteId = await pacientePermitido(ctx);
      if (!pacienteId) return;
      const historial = await PacientesPsicologoModel.historial(
        perfilId(ctx), usuarioPsicologoId(ctx), pacienteId,
      );
      if (!historial) return responderError(ctx, 404, "Paciente no encontrado");
      ctx.response.body = { ok: true, ...historial };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el historial");
    }
  },

  // GET /api/psicologo/pacientes/:pacienteId/notas
  async listarNotas(ctx: RouterContext<string>) {
    try {
      const pacienteId = await pacientePermitido(ctx);
      if (!pacienteId) return;
      const notas = await PacientesPsicologoModel.listarNotas(perfilId(ctx), pacienteId);
      ctx.response.body = { ok: true, notas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar notas");
    }
  },

  // POST /api/psicologo/pacientes/:pacienteId/notas
  async crearNota(ctx: RouterContext<string>) {
    const v = notaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const pacienteId = await pacientePermitido(ctx);
      if (!pacienteId) return;
      const notaId = await PacientesPsicologoModel.crearNota(
        perfilId(ctx), pacienteId, v.data.contenido, v.data.citaId,
      );
      if (!notaId) return responderError(ctx, 400, "Esa cita no corresponde a este paciente");
      ctx.response.status = 201;
      ctx.response.body = { ok: true, notaId };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la nota");
    }
  },

  // PATCH /api/psicologo/notas/:notaId
  async actualizarNota(ctx: RouterContext<string>) {
    const v = actualizarNotaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await PacientesPsicologoModel.actualizarNota(
        perfilId(ctx), ctx.params.notaId ?? "", v.data.contenido,
      );
      if (!ok) return responderError(ctx, 404, "Nota no encontrada");
      ctx.response.body = { ok: true, mensaje: "Nota actualizada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar la nota");
    }
  },

  // DELETE /api/psicologo/notas/:notaId
  async eliminarNota(ctx: RouterContext<string>) {
    try {
      const ok = await PacientesPsicologoModel.eliminarNota(perfilId(ctx), ctx.params.notaId ?? "");
      if (!ok) return responderError(ctx, 404, "Nota no encontrada");
      ctx.response.body = { ok: true, mensaje: "Nota eliminada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al eliminar la nota");
    }
  },
};
