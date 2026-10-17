import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  agendarCitaSchema,
  disponibilidadSchema,
  listarPsicologosSchema,
} from "../../Validators/Explorar/ExplorarValidator.ts";
import { PsicologosExplorarModel } from "../../Model/Explorar/PsicologosExplorarModel.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";

const esUuid = (v: string | undefined) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const PsicologosExplorarController = {

  // GET /api/explorar/psicologos?busqueda=&especialidad=&modalidad=
  async listar(ctx: Context) {
    const v = listarPsicologosSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const [psicologos, especialidades] = await Promise.all([
        PsicologosExplorarModel.listar(v.data),
        PsicologosExplorarModel.especialidadesConPsicologos(),
      ]);
      ctx.response.body = { ok: true, total: psicologos.length, psicologos, especialidades };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar psicólogos");
    }
  },

  // GET /api/explorar/psicologos/:id
  async perfil(ctx: RouterContext<string>) {
    if (!esUuid(ctx.params.id)) return responderError(ctx, 404, "Psicólogo no encontrado");
    try {
      const psicologo = await PsicologosExplorarModel.perfil(ctx.params.id!);
      if (!psicologo) return responderError(ctx, 404, "Psicólogo no encontrado");
      ctx.response.body = { ok: true, psicologo };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el perfil");
    }
  },

  // GET /api/explorar/psicologos/:id/foto  (devuelve la imagen, no JSON)
  async foto(ctx: RouterContext<string>) {
    if (!esUuid(ctx.params.id)) return responderError(ctx, 404, "Sin foto");
    try {
      const img = await PsicologosExplorarModel.foto(ctx.params.id!);
      if (!img) return responderError(ctx, 404, "Sin foto");
      ctx.response.headers.set("Content-Type", img.mime);
      ctx.response.headers.set("Cache-Control", "public, max-age=3600");
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.body = img.bytes;
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la foto");
    }
  },

  // GET /api/explorar/psicologos/:id/disponibilidad?dias=14
  async disponibilidad(ctx: RouterContext<string>) {
    if (!esUuid(ctx.params.id)) return responderError(ctx, 404, "Psicólogo no encontrado");
    const v = disponibilidadSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const dias = await PsicologosExplorarModel.disponibilidad(ctx.params.id!, v.data.dias);
      if (!dias) return responderError(ctx, 404, "Psicólogo no encontrado");
      ctx.response.body = { ok: true, dias };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al consultar la disponibilidad");
    }
  },

  // POST /api/explorar/psicologos/:id/citas   (solo pacientes con sesión)
  async agendar(ctx: RouterContext<string>) {
    if (!esUuid(ctx.params.id)) return responderError(ctx, 404, "Psicólogo no encontrado");
    const v = agendarCitaSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const r = await PsicologosExplorarModel.agendar(String(ctx.state.usuario.id), ctx.params.id!, v.data);
      if ("error" in r) return responderError(ctx, r.status ?? 400, r.error ?? "No se pudo agendar");
      ctx.response.status = 201;
      ctx.response.body = {
        ok: true,
        citaId: r.citaId,
        mensaje: "Tu solicitud fue enviada. El psicólogo debe confirmarla.",
      };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al agendar la cita");
    }
  },
};
