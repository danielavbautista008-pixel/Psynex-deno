import { Context, RouterContext, Status } from "../../Dependencies/dependencias.ts";
import { CuestionarioModel } from "../../Model/Administrador/CuestionariosModel.ts";
import {
  crearCuestionarioSchema,
  cambiarEstadoCuestionarioSchema,
  filtroCuestionariosSchema,
  actualizarCuestionarioSchema,
  editarPreguntasSchema,
} from "../../Validators/Administrador/cuestionarioValidator.ts";
import { leerBody } from "../../Helpers/Peticion.ts";
import { borrarArchivoSubido, guardarArchivo, validarArchivo } from "../../Helpers/Archivos.ts";

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
    // leerBody: si el body viene vacío o mal formado responde 400 (antes daba 500)
    const parsed = crearCuestionarioSchema.safeParse(await leerBody(ctx));

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

  // PATCH /cuestionarios/:id — RF-42, solo Administrador
  async actualizar(ctx: RouterContext<"/cuestionarios/:id">) {
    const parsed = actualizarCuestionarioSchema.safeParse(await leerBody(ctx));
    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, errores: parsed.error.flatten().fieldErrors };
      return;
    }

    const filas = await CuestionarioModel.actualizar(ctx.params.id, parsed.data);
    if (filas === 0) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Cuestionario actualizado" };
  },

  // DELETE /cuestionarios/:id — RF-42, solo Administrador
  async eliminar(ctx: RouterContext<"/cuestionarios/:id">) {
    const resultado = await CuestionarioModel.eliminar(ctx.params.id);

    if (resultado === "no-existe") {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }
    if (resultado === "en-uso") {
      ctx.response.status = Status.Conflict;
      ctx.response.body = {
        ok: false,
        mensaje: "Este cuestionario ya fue respondido o asignado. Desactívalo en lugar de eliminarlo.",
      };
      return;
    }
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Cuestionario eliminado" };
  },

  // PUT /cuestionarios/:id/imagen — solo Administrador.
  // multipart/form-data con el campo "imagen" (JPG o PNG, máximo 5 MB).
  // Se guarda en uploads/cuestionarios/<id>/ y en la BD queda la ruta.
  async subirImagen(ctx: RouterContext<"/cuestionarios/:id/imagen">) {
    if (ctx.request.body.type() !== "form-data") {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, error: "Envía la imagen como multipart/form-data (campo: imagen)" };
      return;
    }

    let archivo: File | null = null;
    try {
      const form = await ctx.request.body.formData();
      const valor = form.get("imagen");
      if (valor instanceof File && valor.size > 0) archivo = valor;
    } catch {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, error: "No se pudo leer el formulario" };
      return;
    }
    if (!archivo) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, error: "Selecciona una imagen" };
      return;
    }

    const r = await validarArchivo(archivo, "Imagen");
    if (!r.ok || r.valor.ext === "pdf") {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, error: r.ok ? "La imagen debe ser JPG o PNG" : r.error };
      return;
    }

    const ruta = await guardarArchivo("cuestionarios", ctx.params.id, archivo, r.valor.ext);
    const resultado = await CuestionarioModel.cambiarImagen(ctx.params.id, ruta);
    if (!resultado.existe) {
      await borrarArchivoSubido(ruta);
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }
    await borrarArchivoSubido(resultado.anterior);

    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Imagen actualizada" };
  },

  // DELETE /cuestionarios/:id/imagen — solo Administrador
  async quitarImagen(ctx: RouterContext<"/cuestionarios/:id/imagen">) {
    const resultado = await CuestionarioModel.cambiarImagen(ctx.params.id, null);
    if (!resultado.existe) {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }
    await borrarArchivoSubido(resultado.anterior);
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Imagen eliminada" };
  },

  // PUT /cuestionarios/:id/preguntas — solo Administrador.
  // Corrige el texto de preguntas y opciones (y los puntajes si nadie lo ha respondido).
  async actualizarPreguntas(ctx: RouterContext<"/cuestionarios/:id/preguntas">) {
    const parsed = editarPreguntasSchema.safeParse(await leerBody(ctx));
    if (!parsed.success) {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, error: parsed.error.issues.map((i) => i.message) };
      return;
    }

    const resultado = await CuestionarioModel.actualizarPreguntas(ctx.params.id, parsed.data);

    if (resultado === "no-existe") {
      ctx.response.status = Status.NotFound;
      ctx.response.body = { ok: false, mensaje: "Cuestionario no encontrado" };
      return;
    }
    if (resultado === "no-pertenece") {
      ctx.response.status = Status.BadRequest;
      ctx.response.body = { ok: false, mensaje: "Alguna pregunta u opción no pertenece a este cuestionario" };
      return;
    }
    if (resultado === "valores-en-uso") {
      ctx.response.status = Status.Conflict;
      ctx.response.body = {
        ok: false,
        mensaje: "Este cuestionario ya tiene respuestas: puedes corregir los textos, pero no los puntajes.",
      };
      return;
    }
    ctx.response.status = Status.OK;
    ctx.response.body = { ok: true, mensaje: "Preguntas actualizadas" };
  },
};
