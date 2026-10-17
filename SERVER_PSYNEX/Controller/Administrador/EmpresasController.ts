import type { RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarEmpresasQuerySchema,
  decidirEmpresaSchema,
} from "../../Validators/Administrador/EmpresasValidator.ts";
import { EmpresasModel } from "../../Model/Administrador/EmpresasModel.ts";
import { EmailService } from "../../Helpers/EmailService.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";

export const EmpresasController = {

  async listar(ctx: RouterContext<string>) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarEmpresasQuerySchema.safeParse(query);

    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const { datos, total } = await EmpresasModel.listar(validacion.data);
      const resumen = await EmpresasModel.resumen();
      ctx.response.body = {
        ok: true,
        resumen,
        total,
        pagina: validacion.data.pagina,
        porPagina: validacion.data.porPagina,
        empresas: datos,
      };
    } catch (error) {
      console.error("Error al listar empresas:", error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar empresas" };
    }
  },

  async resumen(ctx: RouterContext<string>) {
    try {
      const resumen = await EmpresasModel.resumen();
      ctx.response.body = { ok: true, resumen };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener resumen" };
    }
  },

  async detalle(ctx: RouterContext<string>) {
    const id = ctx.params.perfileId;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta perfileId" };
      return;
    }

    try {
      const empresa = await EmpresasModel.buscarPorPerfileId(id);
      if (!empresa) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Empresa no encontrada" };
        return;
      }
      ctx.response.body = { ok: true, empresa };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener detalle" };
    }
  },

  async decidir(ctx: RouterContext<string>) {
    const id = ctx.params.perfileId;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta perfileId" };
      return;
    }

    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      body = null;
    }

    const validacion = decidirEmpresaSchema.safeParse(body);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const empresa = await EmpresasModel.buscarPorPerfileId(id);
      if (!empresa) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Empresa no encontrada" };
        return;
      }

      const { aprobado, motivoRechazo } = validacion.data;
      const ok = aprobado
        ? await EmpresasModel.aprobar(id)
        : await EmpresasModel.rechazar(id);

      if (!ok) {
        ctx.response.status = 400;
        ctx.response.body = { ok: false, error: "No se pudo actualizar la verificación" };
        return;
      }

      EmailService.enviarEstadoCuenta({
        to: empresa.Email,
        nombre: empresa.NombreEmpresa || empresa.NombreCompleto,
        rol: "Empresa",
        aprobado,
        motivoRechazo,
      }).catch((err) => console.error("Error al enviar correo empresa:", err));

      ctx.response.body = {
        ok: true,
        mensaje: aprobado ? "Empresa aprobada" : "Empresa rechazada",
      };
    } catch (error) {
      console.error("Error en verificación empresa:", error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al procesar la verificación" };
    }
  },

  // GET /api/admin/empresas/:perfileId/documentos
  async listarDocumentos(ctx: RouterContext<string>) {
    try {
      const documentos = await EmpresasModel.listarDocumentos(ctx.params.perfileId ?? "");
      ctx.response.body = { ok: true, documentos };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar documentos" };
    }
  },

  // GET /api/admin/empresas/:perfileId/logo  (devuelve la imagen, no JSON)
  async logo(ctx: RouterContext<string>) {
    try {
      const img = decodificarDataUrl(await EmpresasModel.logo(ctx.params.perfileId ?? ""));
      if (!img) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Sin logo" };
        return;
      }
      ctx.response.headers.set("Content-Type", img.mime);
      ctx.response.headers.set("Cache-Control", "private, no-cache");
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = img.bytes;
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener el logo" };
    }
  },
};
