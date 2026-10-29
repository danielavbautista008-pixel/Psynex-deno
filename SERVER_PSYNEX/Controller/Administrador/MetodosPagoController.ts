import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  actualizarMetodoPagoSchema,
  crearMetodoPagoSchema,
} from "../../Validators/Administrador/MetodosPagoValidator.ts";
import { MetodosPagoModel } from "../../Model/Administrador/MetodosPagoModel.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";

export const MetodosPagoController = {
  // GET /api/admin/metodos-pago
  async listar(ctx: Context) {
    try {
      const metodos = await MetodosPagoModel.listar();
      ctx.response.body = { ok: true, metodos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar métodos de pago");
    }
  },

  // POST /api/admin/metodos-pago  { nombre, descripcion?, estadoActivo? }
  async crear(ctx: Context) {
    const v = crearMetodoPagoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await MetodosPagoModel.crear(v.data);
      if ("error" in r) return responderError(ctx, r.status, r.error);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, metodoPagoId: r.id, mensaje: "Método de pago agregado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al crear método de pago");
    }
  },

  // PATCH /api/admin/metodos-pago/:id  { nombre?, descripcion?, estadoActivo? }
  async actualizar(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) return responderError(ctx, 400, "Falta id");
    const v = actualizarMetodoPagoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await MetodosPagoModel.actualizar(id, v.data);
      if ("error" in r) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, mensaje: "Método de pago actualizado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar");
    }
  },

  // DELETE /api/admin/metodos-pago/:id  -> se desactiva, no se borra
  async eliminar(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) return responderError(ctx, 400, "Falta id");
    try {
      const r = await MetodosPagoModel.eliminar(id);
      if ("error" in r) return responderError(ctx, r.status, r.error);
      ctx.response.body = { ok: true, mensaje: "Método desactivado" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al desactivar");
    }
  },
};
