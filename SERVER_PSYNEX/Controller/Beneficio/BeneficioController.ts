// =====================================================================
// Controller/Beneficio/BeneficioController.ts
// Beneficio empresarial: planes para trabajadores, orden de pago,
// comprobante y aprobación del administrador.
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  bancoSchema,
  contratoParamsSchema,
  listarContratosSchema,
  rechazarContratoSchema,
  solicitarPlanSchema,
} from "../../Validators/Beneficio/BeneficioValidator.ts";
import { BeneficioModel } from "../../Model/Beneficio/BeneficioModel.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";
import {
  borrarArchivoSubido,
  guardarArchivo,
  leerArchivoSubido,
  mimeDeRuta,
  validarArchivo,
} from "../../Helpers/Archivos.ts";

const usuarioId = (ctx: Context) => String(ctx.state.usuario?.id ?? "");

// La empresa que inició sesión (o responde el error y devuelve null)
async function miEmpresa(ctx: Context) {
  const empresa = await BeneficioModel.empresaDe(usuarioId(ctx));
  if (!empresa) {
    responderError(ctx, 404, "No encontramos el perfil de tu empresa.");
    return null;
  }
  return empresa;
}

async function enviarComprobante(ctx: Context, ruta: string | null) {
  const bytes = ruta ? await leerArchivoSubido(ruta) : null;
  if (!ruta || !bytes) return responderError(ctx, 404, "No hay comprobante para esta solicitud.");
  ctx.response.headers.set("Content-Type", mimeDeRuta(ruta));
  ctx.response.headers.set("Cache-Control", "private, no-store");
  ctx.response.body = bytes;
}

export const BeneficioController = {

  // ------------------------------ Empresa ------------------------------

  // GET /api/empresa/beneficio
  async resumen(ctx: Context) {
    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      const [contratos, banco, bloqueo] = await Promise.all([
        BeneficioModel.contratosDeEmpresa(empresa.id),
        BeneficioModel.banco(),
        BeneficioModel.bloqueoSolicitud(empresa.id),
      ]);
      ctx.response.body = { ok: true, empresa, contratos, banco, bloqueo };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo cargar tu beneficio empresarial");
    }
  },

  // GET /api/empresa/beneficio/planes
  async planes(ctx: Context) {
    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      const [planes, bloqueo] = await Promise.all([
        BeneficioModel.planes(),
        BeneficioModel.bloqueoSolicitud(empresa.id),
      ]);
      ctx.response.body = { ok: true, empresa, planes, bloqueo };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudieron cargar los planes");
    }
  },

  // POST /api/empresa/beneficio/solicitudes  { planId, empleados }
  async solicitar(ctx: Context) {
    const v = solicitarPlanSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      if (!empresa.verificada) {
        return responderError(ctx, 403, "Tu empresa debe estar verificada por Psynex para contratar un plan.");
      }
      const r = await BeneficioModel.solicitar(empresa.id, v.data);
      if (!("ok" in r)) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo crear la solicitud");
      ctx.response.status = 201;
      ctx.response.body = { ok: true, id: r.id, numeroOrden: r.numeroOrden };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo crear la solicitud");
    }
  },

  // POST /api/empresa/beneficio/solicitudes/:id/comprobante  (form-data: comprobante)
  async subirComprobante(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));

    let archivo: FormDataEntryValue | null = null;
    try {
      archivo = (await ctx.request.body.formData()).get("comprobante");
    } catch {
      return responderError(ctx, 400, "Adjunta el comprobante de pago.");
    }
    if (!(archivo instanceof File)) return responderError(ctx, 400, "Adjunta el comprobante de pago.");

    const valido = await validarArchivo(archivo, "Comprobante");
    if (!valido.ok) return responderError(ctx, 400, valido.error);

    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      const ruta = await guardarArchivo("comprobantes", usuarioId(ctx), archivo, valido.valor.ext);
      const r = await BeneficioModel.guardarComprobante(empresa, p.data.id, ruta);
      if (!("ok" in r)) {
        await borrarArchivoSubido(ruta);
        return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo guardar el comprobante");
      }
      if (r.anterior && r.anterior !== ruta) await borrarArchivoSubido(r.anterior);
      ctx.response.body = { ok: true, mensaje: "Recibimos tu comprobante. Psynex confirmará el pago pronto." };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo guardar el comprobante");
    }
  },

  // GET /api/empresa/beneficio/solicitudes/:id/comprobante
  async verComprobanteEmpresa(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      const c = await BeneficioModel.contratoDeEmpresa(empresa.id, p.data.id);
      await enviarComprobante(ctx, c?.ComprobantePago ? String(c.ComprobantePago) : null);
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo abrir el comprobante");
    }
  },

  // DELETE /api/empresa/beneficio/solicitudes/:id
  async cancelar(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    try {
      const empresa = await miEmpresa(ctx);
      if (!empresa) return;
      const r = await BeneficioModel.cancelar(empresa.id, p.data.id);
      if (!("ok" in r)) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo cancelar");
      await borrarArchivoSubido(r.comprobante);
      ctx.response.body = { ok: true, mensaje: "Solicitud cancelada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo cancelar la solicitud");
    }
  },

  // --------------------------- Administrador ---------------------------

  // GET /api/admin/contratos?estado=
  async listarAdmin(ctx: Context) {
    const q = listarContratosSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!q.success) return responderError(ctx, 400, erroresZod(q.error));
    try {
      const [contratos, banco] = await Promise.all([
        BeneficioModel.listarAdmin(q.data.estado),
        BeneficioModel.banco(),
      ]);
      ctx.response.body = { ok: true, contratos, banco };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudieron cargar los pagos de empresas");
    }
  },

  // GET /api/admin/contratos/:id/comprobante
  async verComprobanteAdmin(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    try {
      await enviarComprobante(ctx, await BeneficioModel.rutaComprobante(p.data.id));
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo abrir el comprobante");
    }
  },

  // PATCH /api/admin/contratos/:id/aprobar
  async aprobar(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    try {
      const r = await BeneficioModel.aprobar(p.data.id);
      if (!("ok" in r)) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo aprobar");
      ctx.response.body = { ok: true, codigo: r.codigo, mensaje: `Pago aprobado. Código generado: ${r.codigo}` };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo aprobar el pago");
    }
  },

  // PATCH /api/admin/contratos/:id/rechazar  { motivo }
  async rechazar(ctx: RouterContext<string>) {
    const p = contratoParamsSchema.safeParse(ctx.params);
    if (!p.success) return responderError(ctx, 400, erroresZod(p.error));
    const v = rechazarContratoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await BeneficioModel.rechazar(p.data.id, v.data.motivo);
      if (!("ok" in r)) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo rechazar");
      ctx.response.body = { ok: true, mensaje: "Pago rechazado. Le avisamos a la empresa." };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudo rechazar el pago");
    }
  },

  // PUT /api/admin/configuracion/banco
  async guardarBanco(ctx: Context) {
    const v = bancoSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await BeneficioModel.guardarBanco(v.data);
      ctx.response.body = { ok: true, mensaje: "Datos bancarios guardados" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "No se pudieron guardar los datos bancarios");
    }
  },
};
