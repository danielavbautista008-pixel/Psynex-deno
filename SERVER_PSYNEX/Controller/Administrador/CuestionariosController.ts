import { Context, RouterContext, Status } from "../../Dependencies/dependencias.ts";
import { CuestionarioModel } from "../../Model/Administrador/CuestionariosModel.ts";
import {
  crearCuestionarioSchema,
  cambiarEstadoCuestionarioSchema,
  filtroCuestionariosSchema,
} from "../../Validators/Administrador/cuestionarioValidator.ts";

export const CuestionarioController = {
  // GET /cuestionarios — RF-24, visible para cualquier usuario logueado
  async listar(ctx: Context) {
    const params = Object.fromEntries(ctx.request.url.searchParams);
    const parsed = filtroCuestionariosSchema.safeParse(params);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const cuestionarios = await CuestionarioModel.listar(parsed.data);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, cuestionarios };
  },

  // GET /cuestionarios/categorias — para el selector del Administrador y filtros
  async listarCategorias(ctx: Context) {
    const categorias = await CuestionarioModel.listarCategorias();
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, categorias };
  },

  // GET /cuestionarios/:id — detalle con preguntas y opciones, para responderlo
  async obtenerConPreguntas(ctx: RouterContext<"/cuestionarios/:id">) {
    const { id } = ctx.params;
    const cuestionario = await CuestionarioModel.obtenerPorId(id);

    if (!cuestionario) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }

    const preguntas = await CuestionarioModel.obtenerPreguntasConOpciones(id);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, cuestionario, preguntas };
  },

  // POST /cuestionarios — RF-42, solo Administrador
  async crear(ctx: Context) {
    const body = await ctx.request.body.json();
    const parsed = crearCuestionarioSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const cuestionarioId = await CuestionarioModel.crear(parsed.data);
    ctx.response.status = Status.Created;
    ctx.response.body = { ok: true, cuestionarioId };
  },

  // PATCH /cuestionarios/:id/estado — RF-42, activar/desactivar, solo Administrador
  async cambiarEstado(ctx: RouterContext<"/cuestionarios/:id/estado">) {
    const { id } = ctx.params;
    const body = await ctx.request.body.json();
    const parsed = cambiarEstadoCuestionarioSchema.safeParse(body);

    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const cuestionario = await CuestionarioModel.obtenerPorId(id);
    if (!cuestionario) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }

    await CuestionarioModel.cambiarEstado(id, parsed.data.estadoActivo);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Estado actualizado" };
  },

  // GET /cuestionarios/estadisticas — RF-42, solo Administrador
  async estadisticas(ctx: Context) {
    const datos = await CuestionarioModel.estadisticasUso();
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, datos };
  },
};
