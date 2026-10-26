// =====================================================================
// cambio: ARCHIVO NUEVO — Mi perfil del paciente
//   GET    /api/paciente/perfil          datos del perfil
//   PATCH  /api/paciente/perfil          { nombre, telefono, fechaNacimiento, genero, ocupacion }
//   GET    /api/paciente/perfil/foto     la imagen (no JSON)
//   PUT    /api/paciente/perfil/foto     { foto: "data:image/jpeg;base64,..." }
//   DELETE /api/paciente/perfil/foto     quitar la foto
//   PATCH  /api/paciente/perfil/ajustes  { recordatorios }
// =====================================================================
import type { Context } from "../../Dependencies/dependencias.ts";
import { PerfilPacienteModel } from "../../Model/Paciente/PerfilPacienteModel.ts";
import {
  actualizarPerfilPacienteSchema,
  ajustesPacienteSchema,
  fotoPacienteSchema,
} from "../../Validators/Paciente/PerfilPacienteValidator.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";
import { responderImagen } from "../../Helpers/Imagen.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";

const usuarioDe = (ctx: Context) => String(ctx.state.usuario?.id ?? "");

// El texto "data:image/png" se puede inventar; los primeros bytes de la imagen no
const esImagenReal = (b: Uint8Array) =>
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||                       // JPG
  (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ||      // PNG
  (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&       // WEBP
   b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50);

export const PerfilPacienteController = {
  async obtener(ctx: Context) {
    try {
      const perfil = await PerfilPacienteModel.obtener(usuarioDe(ctx));
      if (!perfil) return responderError(ctx, 404, "No encontramos tu perfil");
      ctx.response.body = { ok: true, perfil };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener tu perfil");
    }
  },

  async actualizar(ctx: Context) {
    const v = actualizarPerfilPacienteSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await PerfilPacienteModel.actualizar(usuarioDe(ctx), v.data);
      ctx.response.body = { ok: true, mensaje: "Perfil actualizado", perfil: await PerfilPacienteModel.obtener(usuarioDe(ctx)) };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar tu perfil");
    }
  },

  async foto(ctx: Context) {
    try {
      const img = decodificarDataUrl(await PerfilPacienteModel.foto(usuarioDe(ctx)));
      if (!img) return responderError(ctx, 404, "Sin foto");
      await responderImagen(ctx, img);
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la foto");
    }
  },

  async guardarFoto(ctx: Context) {
    const v = fotoPacienteSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    const img = decodificarDataUrl(v.data.foto);
    if (!img || !esImagenReal(img.bytes)) return responderError(ctx, 400, "El archivo no es una imagen válida");
    try {
      await PerfilPacienteModel.guardarFoto(usuarioDe(ctx), v.data.foto);
      ctx.response.body = { ok: true, mensaje: "Foto actualizada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la foto");
    }
  },

  async quitarFoto(ctx: Context) {
    try {
      await PerfilPacienteModel.guardarFoto(usuarioDe(ctx), null);
      ctx.response.body = { ok: true, mensaje: "Foto eliminada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al quitar la foto");
    }
  },

  async ajustes(ctx: Context) {
    const v = ajustesPacienteSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      await PerfilPacienteModel.guardarAjustes(usuarioDe(ctx), v.data.recordatorios);
      ctx.response.body = { ok: true, mensaje: "Preferencia guardada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al guardar la preferencia");
    }
  },
};
