import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarPlanesQuerySchema,
  crearPlanSchema,
  actualizarPlanSchema,
} from "../../Validators/Administrador/PlanesValidator.ts";
import { PlanesModel } from "../../Model/Administrador/PlanesModel.ts";

async function leerBody(ctx: Context) {
  try {
    return await ctx.request.body.json();
  } catch {
    return null;
  }
}

export const PlanesController = {

  async listarAdmin(ctx: Context) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const v = listarPlanesQuerySchema.safeParse(query);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const { datos, total } = await PlanesModel.listar(v.data, false);
      ctx.response.body = {
        ok: true,
        total,
        pagina: v.data.pagina,
        porPagina: v.data.porPagina,
        planes: datos,
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar planes" };
    }
  },

  async listarPublico(ctx: Context) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const v = listarPlanesQuerySchema.safeParse(query);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const { datos, total } = await PlanesModel.listar(v.data, true);
      ctx.response.body = { ok: true, total, planes: datos };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar planes" };
    }
  },

  async detalleAdmin(ctx: RouterContext<string>) {
    const plan = await PlanesModel.buscarPorId(ctx.params.id ?? "");
    if (!plan) {
      ctx.response.status = 404;
      ctx.response.body = { ok: false, error: "Plan no encontrado" };
      return;
    }
    ctx.response.body = { ok: true, plan };
  },

  async crear(ctx: Context) {
    const body = await leerBody(ctx);
    const v = crearPlanSchema.safeParse(body);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const adminId = String(ctx.state.usuarioId ?? ctx.state.usuario?.id);
      const id = await PlanesModel.crear(v.data, adminId);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, planId: id };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al crear plan" };
    }
  },

  async actualizar(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta id" };
      return;
    }
    const body = await leerBody(ctx);
    const v = actualizarPlanSchema.safeParse(body);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const ok = await PlanesModel.actualizar(id, v.data);
      if (!ok) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Plan no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, mensaje: "Plan actualizado" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al actualizar plan" };
    }
  },

  async eliminar(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta id" };
      return;
    }
    try {
      const ok = await PlanesModel.eliminar(id);
      if (!ok) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Plan no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, mensaje: "Plan eliminado" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al eliminar plan" };
    }
  },
};