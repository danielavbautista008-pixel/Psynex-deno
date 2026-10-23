import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarPostulacionModel,
  contarPostulacionesPorEmpresaYEstado,
  contarPostulacionesPorUsuarioYEstado,
  crearPostulacionModel,
  eliminarPostulacionModel,
  existePostulacionModel,
  obtenerPostulacionPorId,
  obtenerPostulacionesPorEmpresa,
  obtenerPostulacionesPorUsuario,
} from "../../Model/Empresa/postulacionesModel.ts";

// Obtener postulación por ID
export const getPostulacionById = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;
    const postulacion = await obtenerPostulacionPorId(id);

    if (!postulacion) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "Postulación no encontrada",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: postulacion };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al buscar la postulación",
      error: String(error),
    };
  }
};

// Obtener postulaciones realizadas por un usuario
export const getPostulacionesPorUsuario = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { usuarioId } = ctx.params;
    const postulaciones = await obtenerPostulacionesPorUsuario(usuarioId);

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: postulaciones };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener las postulaciones del usuario",
      error: String(error),
    };
  }
};

// Obtener postulaciones recibidas por una empresa (PerfilId)
export const getPostulacionesPorEmpresa = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { perfileId } = ctx.params;
    const postulaciones = await obtenerPostulacionesPorEmpresa(perfileId);

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: postulaciones };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener las postulaciones recibidas por la empresa",
      error: String(error),
    };
  }
};

// Crear nueva postulación
export const postPostulacion = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const usuarioLogueado = ctx.state.user;

    const usuarioId = usuarioLogueado?.sub || body.UsuarioId;

    if (!body.OfertaId || !usuarioId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan campos obligatorios (OfertaId, UsuarioId)",
      };
      return;
    }

    // Validar si el usuario ya se postuló previamente a esta oferta
    const yaExiste = await existePostulacionModel(body.OfertaId, usuarioId);
    if (yaExiste) {
      ctx.response.status = 409; // Conflict
      ctx.response.body = {
        success: false,
        message: "El usuario ya se encuentra postulado a esta oferta laboral",
      };
      return;
    }

    const nuevaPostulacion = {
      PostulacionId: body.PostulacionId || crypto.randomUUID(),
      ...body,
      UsuarioId: usuarioId,
      Estado: body.Estado || "Pendiente",
    };

    const resultado = await crearPostulacionModel(nuevaPostulacion);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Postulación registrada exitosamente",
      PostulacionId: nuevaPostulacion.PostulacionId,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al crear la postulación",
      error: String(error),
    };
  }
};

// Actualizar información o estado de una postulación
export const putPostulacion = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;
    const body = await ctx.request.body.json();

    const existe = await obtenerPostulacionPorId(id);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "La postulación no existe",
      };
      return;
    }

    await actualizarPostulacionModel(id, body);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Postulación actualizada correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar la postulación",
      error: String(error),
    };
  }
};

// Eliminar postulación
export const deletePostulacion = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID de la postulación",
      };
      return;
    }

    const existe = await obtenerPostulacionPorId(id);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "La postulación no existe",
      };
      return;
    }

    await eliminarPostulacionModel(id);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Postulación eliminada correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al eliminar la postulación: " + String(error),
    };
  }
};

//contar postulaciones por empresa
// export const contarPostulacionesPorEmpresa = async (ctx: Context) => {
//   try {
//     // @ts-ignore
//     const { perfileId } = ctx.params;
//     const { estado } = ctx.request.url.searchParams;

//     const total = await contarPostulacionesPorEmpresaYEstado(perfileId, estado);
//     ctx.response.status = 200;
//     ctx.response.body = {
//       success: true,
//       message: "Total de postulaciones contadas",
//       total,
//     };
//   } catch (error) {
//     ctx.response.status = 500;
//     ctx.response.body = {
//       success: false,
//       message: "Error al contar las postulaciones",
//       error: String(error),
//     };
//   }
// };

// contarpostulaciones por usuario y estado
// export const contarPostulacionesPorUsuario = async (ctx: Context) => {
//   try {
//     // @ts-ignore
//     const { usuarioId } = ctx.params;
//     const { Estado } = ctx.request.url.searchParams;

//     const total = await contarPostulacionesPorUsuarioYEstado(usuarioId, Estado);
//     ctx.response.status = 200;
//     ctx.response.body = {
//       success: true,
//       message: "Total de postulaciones contadas",
//       total,
//     };
//   } catch (error) {
//     ctx.response.status = 500;
//     ctx.response.body = {
//       success: false,
//       message: "Error al contar las postulaciones",
//       error: String(error),
//     };
//   }
// };
