import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  crearMetodoPagoSchema,
  actualizarMetodoPagoSchema,
} from "../../Validators/Administrador/MetodosPagoValidator.ts";
import { MetodosPagoModel } from "../../Model/Administrador/MetodosPagoModel.ts";

async function leerBody(ctx: Context) {
  try {
    return await ctx.request.body.json();
  } catch {
    return null;
  }
}

export const MetodosPagoController = {
  async listar(ctx: Context) {
    try {
      const metodos = await MetodosPagoModel.listar();
      ctx.response.body = { ok: true, metodos };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar métodos de pago" };
    }
  },

  async crear(ctx: Context) {
    const body = await leerBody(ctx);
    const v = crearMetodoPagoSchema.safeParse(body);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const id = await MetodosPagoModel.crear(v.data);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, metodoPagoId: id };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al crear método de pago" };
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
    const v = actualizarMetodoPagoSchema.safeParse(body);
    if (!v.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: v.error.issues.map((i) => i.message) };
      return;
    }
    try {
      const ok = await MetodosPagoModel.actualizar(id, v.data);
      if (!ok) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Método no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, mensaje: "Actualizado" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al actualizar" };
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
      await MetodosPagoModel.eliminar(id);
      ctx.response.body = { ok: true, mensaje: "Método desactivado" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al desactivar" };
    }
  },
};