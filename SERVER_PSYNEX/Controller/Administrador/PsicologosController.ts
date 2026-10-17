import type { RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarPsicologosQuerySchema,
  decidirVerificacionSchema,
} from "../../Validators/Administrador/PsicologosValidator.ts";
import { PsicologosModel } from "../../Model/Administrador/PsicologosModel.ts";
import { EmailService } from "../../Helpers/EmailService.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";

export const PsicologosController = {

  // GET /api/admin/psicologos
  async listar(ctx: RouterContext<string>) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarPsicologosQuerySchema.safeParse(query);

    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const { datos, total } = await PsicologosModel.listar(validacion.data);
      const resumen = await PsicologosModel.resumen();

      ctx.response.body = {
        ok: true,
        resumen,
        total,
        pagina: validacion.data.pagina,
        porPagina: validacion.data.porPagina,
        psicologos: datos,
      };
    } catch (error) {
      console.error("Error al listar psicólogos:", error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar psicólogos" };
    }
  },

  // GET /api/admin/psicologos/resumen
  async resumen(ctx: RouterContext<string>) {
    try {
      const resumen = await PsicologosModel.resumen();
      ctx.response.body = { ok: true, resumen };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener resumen" };
    }
  },

  // GET /api/admin/psicologos/:perfilId
  async detalle(ctx: RouterContext<string>) {
    const perfilId = ctx.params.perfilId;
    if (!perfilId) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta perfilId" };
      return;
    }

    try {
      const psicologo = await PsicologosModel.buscarPorPerfilId(perfilId);
      if (!psicologo) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Psicólogo no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, psicologo };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener detalle" };
    }
  },

  // PATCH /api/admin/psicologos/:perfilId/verificacion
  async decidir(ctx: RouterContext<string>) {
    const perfilId = ctx.params.perfilId;
    if (!perfilId) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta perfilId" };
      return;
    }

    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      body = null;
    }

    const validacion = decidirVerificacionSchema.safeParse(body);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const psicologo = await PsicologosModel.buscarPorPerfilId(perfilId);
      if (!psicologo) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Psicólogo no encontrado" };
        return;
      }

      const { aprobado, motivoRechazo } = validacion.data;

      const ok = aprobado
        ? await PsicologosModel.aprobar(perfilId)
        : await PsicologosModel.rechazar(perfilId, motivoRechazo ?? "");

      if (!ok) {
        ctx.response.status = 400;
        ctx.response.body = { ok: false, error: "No se pudo actualizar la verificación" };
        return;
      }

      // Correo en segundo plano (no bloquea la respuesta)
      EmailService.enviarEstadoCuenta({
        to: psicologo.Email,
        nombre: psicologo.NombreCompleto,
        rol: "Psicologo",
        aprobado,
        motivoRechazo: motivoRechazo,
      }).catch((err) => console.error("Error al enviar correo de verificación:", err));

      ctx.response.body = {
        ok: true,
        mensaje: aprobado ? "Psicólogo aprobado" : "Psicólogo rechazado",
      };
    } catch (error) {
      console.error("Error en verificación:", error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al procesar la verificación" };
    }
  },

  // GET /api/admin/psicologos/:perfilId/documentos
  async listarDocumentos(ctx: RouterContext<string>) {
    try {
      const documentos = await PsicologosModel.listarDocumentos(ctx.params.perfilId ?? "");
      ctx.response.body = { ok: true, documentos };
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar documentos" };
    }
  },

  // GET /api/admin/psicologos/documentos/:documentoId — abre el archivo
  // Solo el admin puede verlo; los archivos NO están en una carpeta pública.
  async verDocumento(ctx: RouterContext<string>) {
    try {
      const doc = await PsicologosModel.obtenerDocumento(ctx.params.documentoId ?? "");
      if (!doc) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Documento no encontrado" };
        return;
      }

      // Seguridad: la ruta guardada debe estar dentro de ./uploads
      const base = await Deno.realPath("./uploads");
      const ruta = await Deno.realPath(String(doc.RutaArchivo));
      if (!ruta.startsWith(base)) {
        ctx.response.status = 403;
        ctx.response.body = { ok: false, error: "Ruta de archivo no permitida" };
        return;
      }

      ctx.response.headers.set("Content-Type", String(doc.Mime));
      ctx.response.headers.set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(String(doc.NombreOriginal))}"`,
      );
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.headers.set("Cache-Control", "private, no-store");
      ctx.response.body = await Deno.readFile(ruta);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "El archivo ya no existe en el servidor" };
        return;
      }
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al abrir el documento" };
    }
  },

  // GET /api/admin/psicologos/:perfilId/foto  (devuelve la imagen, no JSON)
  async foto(ctx: RouterContext<string>) {
    try {
      const img = decodificarDataUrl(await PsicologosModel.foto(ctx.params.perfilId ?? ""));
      if (!img) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Sin foto" };
        return;
      }
      ctx.response.headers.set("Content-Type", img.mime);
      // no-cache: si el psicólogo cambia la foto, se ve la nueva
      ctx.response.headers.set("Cache-Control", "private, no-cache");
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = img.bytes;
    } catch (error) {
      console.error(error);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener la foto" };
    }
  },
};
