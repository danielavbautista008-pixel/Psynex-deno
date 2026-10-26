import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarMovimientosSchema,
  cuentaSchema,
  actualizarCuentaSchema,
  reclamoSchema,
} from "../../Validators/Psicologo/FinanzasPsicologoValidator.ts";
import { FinanzasPsicologoModel } from "../../Model/Psicologo/FinanzasPsicologoModel.ts";
import { leerBody, erroresZod, responderError } from "../../Helpers/Peticion.ts";
import { avisarAdmins } from "../../Helpers/AvisosAdmin.ts"; // cambio: avisos al administrador
import { conexion } from "../../Model/conexion.ts";

const perfilId = (ctx: Context) => String(ctx.state.perfilPsicologo.PerfilId);

export const FinanzasPsicologoController = {

  // GET /api/psicologo/finanzas/resumen
  async resumen(ctx: Context) {
    try {
      const resumen = await FinanzasPsicologoModel.resumen(perfilId(ctx));
      ctx.response.body = { ok: true, resumen };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el resumen financiero");
    }
  },

  // GET /api/psicologo/finanzas/movimientos?transferencia=&pagina=&porPagina=
  async movimientos(ctx: Context) {
    const v = listarMovimientosSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const { datos, total } = await FinanzasPsicologoModel.movimientos(perfilId(ctx), v.data);
      ctx.response.body = { ok: true, total, pagina: v.data.pagina, porPagina: v.data.porPagina, movimientos: datos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar movimientos");
    }
  },

  // GET /api/psicologo/finanzas/cuentas
  async listarCuentas(ctx: Context) {
    try {
      const cuentas = await FinanzasPsicologoModel.listarCuentas(perfilId(ctx));
      ctx.response.body = { ok: true, cuentas };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar cuentas");
    }
  },

  // POST /api/psicologo/finanzas/cuentas
  async crearCuenta(ctx: Context) {
    const v = cuentaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const cuentaId = await FinanzasPsicologoModel.crearCuenta(perfilId(ctx), v.data);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, cuentaId };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al registrar la cuenta");
    }
  },

  // PATCH /api/psicologo/finanzas/cuentas/:id
  async actualizarCuenta(ctx: RouterContext<string>) {
    const v = actualizarCuentaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const ok = await FinanzasPsicologoModel.actualizarCuenta(perfilId(ctx), ctx.params.id ?? "", v.data);
      if (!ok) return responderError(ctx, 404, "Cuenta no encontrada");
      ctx.response.body = { ok: true, mensaje: "Cuenta actualizada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al actualizar la cuenta");
    }
  },

  // DELETE /api/psicologo/finanzas/cuentas/:id
  async eliminarCuenta(ctx: RouterContext<string>) {
    try {
      const ok = await FinanzasPsicologoModel.eliminarCuenta(perfilId(ctx), ctx.params.id ?? "");
      if (!ok) return responderError(ctx, 404, "Cuenta no encontrada");
      ctx.response.body = { ok: true, mensaje: "Cuenta eliminada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al eliminar la cuenta");
    }
  },

  // GET /api/psicologo/finanzas/reclamos
  async listarReclamos(ctx: Context) {
    try {
      const reclamos = await FinanzasPsicologoModel.listarReclamos(perfilId(ctx));
      ctx.response.body = { ok: true, reclamos };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar reclamos");
    }
  },

  // POST /api/psicologo/finanzas/reclamos
  async crearReclamo(ctx: Context) {
    const v = reclamoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const reclamoId = await FinanzasPsicologoModel.crearReclamo(perfilId(ctx), v.data);
      if (!reclamoId) return responderError(ctx, 404, "Ese pago no corresponde a tus citas");

      // cambio: avisar al administrador (campanita + correo) que hay un reclamo por responder
      const [ps] = await conexion.query(
        `SELECT u.NombreCompleto, u.Email FROM perfilpsicologo p JOIN usuarios u ON u.UsuarioId = p.UsuarioId
         WHERE p.PerfilId = ? LIMIT 1`,
        [perfilId(ctx)],
      ) as { NombreCompleto: string; Email: string }[];
      avisarAdmins(
        "Nuevo reclamo de pago",
        `${ps?.NombreCompleto ?? "Un psicólogo"} envió un reclamo sobre sus pagos: "${v.data.motivo}".`,
        "/Administrador/reclamos",
        {
          boton: "Responder reclamo",
          detalles: [
            ["Psicólogo", `${ps?.NombreCompleto ?? ""} (${ps?.Email ?? ""})`],
            ["Motivo", v.data.motivo],
            ["Descripción", v.data.descripcion],
          ],
        },
      );

      ctx.response.status = 201;
      ctx.response.body = { ok: true, reclamoId };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al registrar el reclamo");
    }
  },
};
