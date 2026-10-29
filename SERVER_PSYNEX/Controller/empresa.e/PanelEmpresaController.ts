// =====================================================================
// PANEL DE EMPRESA (carpeta empresa.e) — solo con sesión de Empresa
//   GET    /api/empresa/perfil                          perfil de la empresa
//   PUT    /api/empresa/perfil                          guardar perfil (+ logo)
//   GET    /api/empresa/resumen                         números del Inicio + últimas postulaciones
//   GET    /api/empresa/ofertas                         mis ofertas
//   POST   /api/empresa/ofertas                         publicar oferta
//   PUT    /api/empresa/ofertas/:id                     editar oferta
//   PATCH  /api/empresa/ofertas/:id/estado              { estado: Activa | Cerrada }
//   PATCH  /api/empresa/postulaciones/:id/estado        { estado: Pendiente | Aceptado | Rechazado }
//   GET    /api/empresa/favoritos                       psicólogos favoritos
//   POST   /api/empresa/favoritos/:perfilId             agregar
//   DELETE /api/empresa/favoritos/:perfilId             quitar
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { PanelEmpresaModel } from "../../Model/empresa.e/PanelEmpresaModel.ts";
import {
  estadoOfertaSchema,
  estadoPostulacionSchema,
  ofertaSchema,
  perfilEmpresaSchema,
} from "../../Validators/empresa.e/PanelEmpresaValidator.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usuarioDe = (ctx: Context) => String(ctx.state.usuario?.id ?? "");
const esError = (r: unknown): r is { error: string; status: number } =>
  typeof r === "object" && r !== null && "error" in r;

// Ejecuta la acción y responde con el formato del proyecto ({ ok, ... } o { ok:false, error })
async function responder(ctx: Context, mensajeError: string, accion: () => Promise<unknown>, clave?: string) {
  try {
    const r = await accion();
    if (esError(r)) return responderError(ctx, r.status, r.error);
    ctx.response.body = clave ? { ok: true, [clave]: r } : { ok: true, ...(r as object) };
  } catch (e) {
    console.error(e);
    responderError(ctx, 500, mensajeError);
  }
}

export const PanelEmpresaController = {
  async perfil(ctx: Context) {
    await responder(ctx, "Error al cargar el perfil", async () => {
      const p = await PanelEmpresaModel.perfil(usuarioDe(ctx));
      return p ?? { error: "No encontramos el perfil de tu empresa.", status: 404 };
    }, "perfil");
  },

  async guardarPerfil(ctx: Context) {
    const v = perfilEmpresaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    await responder(ctx, "No se pudo guardar el perfil", () => PanelEmpresaModel.actualizarPerfil(usuarioDe(ctx), v.data));
  },

  async resumen(ctx: Context) {
    await responder(ctx, "Error al cargar el resumen", () => PanelEmpresaModel.resumen(usuarioDe(ctx)));
  },

  async ofertas(ctx: Context) {
    await responder(ctx, "Error al cargar las ofertas", () => PanelEmpresaModel.ofertas(usuarioDe(ctx)), "ofertas");
  },

  async crearOferta(ctx: Context) {
    const v = ofertaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    await responder(ctx, "No se pudo publicar la oferta", () => PanelEmpresaModel.crearOferta(usuarioDe(ctx), v.data));
  },

  async editarOferta(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Oferta no encontrada");
    const v = ofertaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    await responder(ctx, "No se pudo guardar la oferta", () => PanelEmpresaModel.editarOferta(usuarioDe(ctx), id, v.data));
  },

  async estadoOferta(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Oferta no encontrada");
    const v = estadoOfertaSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    await responder(ctx, "No se pudo cambiar la oferta", () => PanelEmpresaModel.estadoOferta(usuarioDe(ctx), id, v.data.estado));
  },

  async estadoPostulacion(ctx: RouterContext<string>) {
    const id = ctx.params.id ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Postulación no encontrada");
    const v = estadoPostulacionSchema.safeParse((await leerBody(ctx)) ?? {});
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    await responder(ctx, "No se pudo actualizar la postulación", () =>
      PanelEmpresaModel.estadoPostulacion(usuarioDe(ctx), id, v.data.estado));
  },

  async favoritos(ctx: Context) {
    await responder(ctx, "Error al cargar los favoritos", async () => ({
      favoritos: await PanelEmpresaModel.favoritos(usuarioDe(ctx)),
      ids: await PanelEmpresaModel.idsFavoritos(usuarioDe(ctx)),
    }));
  },

  async agregarFavorito(ctx: RouterContext<string>) {
    const id = ctx.params.perfilId ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Psicólogo no encontrado");
    await responder(ctx, "No se pudo guardar el favorito", () => PanelEmpresaModel.agregarFavorito(usuarioDe(ctx), id));
  },

  async quitarFavorito(ctx: RouterContext<string>) {
    const id = ctx.params.perfilId ?? "";
    if (!UUID.test(id)) return responderError(ctx, 404, "Psicólogo no encontrado");
    await responder(ctx, "No se pudo quitar el favorito", () => PanelEmpresaModel.quitarFavorito(usuarioDe(ctx), id));
  },
};
