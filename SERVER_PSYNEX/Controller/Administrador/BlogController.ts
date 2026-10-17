import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarBlogQuerySchema,
  crearArticuloSchema,
  actualizarArticuloSchema,
} from "../../Validators/Administrador/BlogValidator.ts";
import { BlogModel } from "../../Model/Administrador/BlogModel.ts";
import {
  borrarArchivoSubido,
  borrarCarpetaUsuario,
  guardarArchivo,
  leerArchivoSubido,
  mimeDeRuta,
  validarArchivo,
} from "../../Helpers/Archivos.ts";

// Solo las portadas subidas desde el panel viven en ./uploads
const esArchivoSubido = (ruta: string | null) => !!ruta && ruta.startsWith("./uploads/");

async function leerBody(ctx: Context): Promise<unknown | null> {
  try {
    return await ctx.request.body.json();
  } catch {
    return null;
  }
}

export const BlogController = {

  // Admin: todos los artículos
  async listarAdmin(ctx: Context) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarBlogQuerySchema.safeParse(query);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: validacion.error.issues.map((i) => i.message) };
      return;
    }

    try {
      const { datos, total } = await BlogModel.listar(validacion.data, false);
      ctx.response.body = {
        ok: true,
        total,
        pagina: validacion.data.pagina,
        porPagina: validacion.data.porPagina,
        articulos: datos,
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar artículos" };
    }
  },

  // Público: solo publicados
  async listarPublico(ctx: Context) {
    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarBlogQuerySchema.safeParse(query);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: validacion.error.issues.map((i) => i.message) };
      return;
    }

    try {
      const { datos, total } = await BlogModel.listar(validacion.data, true);
      ctx.response.body = {
        ok: true,
        total,
        articulos: datos,
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar blog" };
    }
  },

  async detalleAdmin(ctx: RouterContext<string>) {
    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta id" };
      return;
    }
    const articulo = await BlogModel.buscarPorId(id);
    if (!articulo) {
      ctx.response.status = 404;
      ctx.response.body = { ok: false, error: "Artículo no encontrado" };
      return;
    }
    ctx.response.body = { ok: true, articulo };
  },

  async detallePublico(ctx: RouterContext<string>) {
    const slug = ctx.params.slug;
    if (!slug) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta slug" };
      return;
    }
    const articulo = await BlogModel.buscarPorSlug(slug, true);
    if (!articulo) {
      ctx.response.status = 404;
      ctx.response.body = { ok: false, error: "Artículo no encontrado" };
      return;
    }
    ctx.response.body = { ok: true, articulo };
  },

  async crear(ctx: Context) {
    const body = await leerBody(ctx);
    const validacion = crearArticuloSchema.safeParse(body);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: validacion.error.issues.map((i) => i.message) };
      return;
    }

    try {
      const adminId = String(ctx.state.usuarioId ?? ctx.state.usuario?.id);
      const id = await BlogModel.crear(validacion.data, adminId);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, articuloId: id };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al crear artículo" };
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
    const validacion = actualizarArticuloSchema.safeParse(body);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: validacion.error.issues.map((i) => i.message) };
      return;
    }

    try {
      const ok = await BlogModel.actualizar(id, validacion.data);
      if (!ok) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Artículo no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, mensaje: "Artículo actualizado" };
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
      const ok = await BlogModel.eliminar(id);
      if (ok) await borrarCarpetaUsuario("blog", id); // portada guardada
      if (!ok) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Artículo no encontrado" };
        return;
      }
      ctx.response.body = { ok: true, mensaje: "Artículo eliminado" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al eliminar" };
    }
  },
  // PUT /api/admin/blog/:id/imagen  (multipart, campo "imagen": JPG o PNG)
  async subirImagen(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (ctx.request.body.type() !== "form-data") {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Envía la imagen como multipart/form-data (campo: imagen)" };
      return;
    }

    let archivo: File | null = null;
    try {
      const form = await ctx.request.body.formData();
      const valor = form.get("imagen");
      if (valor instanceof File && valor.size > 0) archivo = valor;
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "No se pudo leer el formulario" };
      return;
    }
    if (!archivo) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Selecciona una imagen" };
      return;
    }

    const r = await validarArchivo(archivo, "Imagen");
    if (!r.ok || r.valor.ext === "pdf") {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: r.ok ? "La imagen debe ser JPG o PNG" : r.error };
      return;
    }

    try {
      // Primero se confirma que el artículo existe: el id se usa como carpeta
      if (!(await BlogModel.buscarPorId(id))) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Artículo no encontrado" };
        return;
      }
      const ruta = await guardarArchivo("blog", id, archivo, r.valor.ext);
      const resultado = await BlogModel.cambiarImagen(id, ruta);
      if (!resultado.existe) {
        await borrarArchivoSubido(ruta);
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Artículo no encontrado" };
        return;
      }
      if (esArchivoSubido(resultado.anterior)) await borrarArchivoSubido(resultado.anterior);
      ctx.response.body = { ok: true, mensaje: "Portada actualizada" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al guardar la imagen" };
    }
  },

  // DELETE /api/admin/blog/:id/imagen
  async quitarImagen(ctx: RouterContext<string>) {
    try {
      const resultado = await BlogModel.cambiarImagen(ctx.params.id ?? "", null);
      if (!resultado.existe) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Artículo no encontrado" };
        return;
      }
      if (esArchivoSubido(resultado.anterior)) await borrarArchivoSubido(resultado.anterior);
      ctx.response.body = { ok: true, mensaje: "Portada eliminada" };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al quitar la imagen" };
    }
  },

  // GET /api/blog/:id/imagen  (público: devuelve la imagen, no JSON)
  async imagen(ctx: RouterContext<string>) {
    try {
      const ruta = await BlogModel.rutaImagen(ctx.params.id ?? "");
      const bytes = esArchivoSubido(ruta) ? await leerArchivoSubido(ruta!) : null;
      if (!ruta || !bytes) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Sin imagen" };
        return;
      }
      ctx.response.headers.set("Content-Type", mimeDeRuta(ruta));
      ctx.response.headers.set("Cache-Control", "public, max-age=3600");
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = bytes;
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener la imagen" };
    }
  },
};