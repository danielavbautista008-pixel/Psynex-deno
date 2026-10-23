import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarPerfilEmpresaModel,
  crearPerfilEmpresaModel,
  eliminarPerfilEmpresaModel,
  obtenerPerfilEmpresaPorId,
  obtenerPerfilEmpresaPorUsuarioId,
  obtenerTodosPerfilesEmpresa,
} from "../../Model/Empresa/perfilModel.ts";

// Listar todos los perfiles
export const getPerfilEmpresa = async (ctx: Context) => {
  try {
    const perfiles = await obtenerTodosPerfilesEmpresa();
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: perfiles,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener los perfiles de empresa",
      error: String(error),
    };
  }
};

// Obtener un perfil por ID
export const getPerfilEmpresaPorId = async (ctx: Context) => {
  try {
    // @ts-ignore (Oak extrae params de la ruta)
    const { PerfileId } = ctx.params;
    const perfil = await obtenerPerfilEmpresaPorId(PerfileId);

    if (!perfil) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `No se encontró el perfil de empresa con ID ${PerfileId}`,
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: perfil };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al buscar el perfil de empresa",
      error: String(error),
    };
  }
};

// Obtener perfil por ID de Usuario
export const getPerfilEmpresaPorUsuarioId = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { usuarioId } = ctx.params;
    const perfil = await obtenerPerfilEmpresaPorUsuarioId(usuarioId);

    if (!perfil) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `No se encontró el perfil para el usuario con ID ${usuarioId}`,
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: perfil };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al buscar el perfil del usuario",
      error: String(error),
    };
  }
};

// Crear perfil de empresa
export const postPerfilEmpresa = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const usuarioLogueado = ctx.state.user; // Usuario obtenido desde JWT

    if (!body.NombreEmpresa || !body.Nit) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan campos obligatorios (NombreEmpresa, Nit)",
      };
      return;
    }

    const nuevoPerfil = {
      ...body,
      UsuarioId: usuarioLogueado?.sub || body.UsuarioId,
    };

    const idCreado = await crearPerfilEmpresaModel(nuevoPerfil);

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Perfil de empresa creado exitosamente",
      PerfileId: idCreado,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al crear el perfil de empresa",
      error: String(error),
    };
  }
};

// Actualizar perfil de empresa
export const putPerfilEmpresa = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;
    const body = await ctx.request.body.json();

    const existe = await obtenerPerfilEmpresaPorId(id);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "El perfil de empresa no existe",
      };
      return;
    }

    await actualizarPerfilEmpresaModel(id, body);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Perfil de empresa actualizado correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el perfil de empresa",
      error: String(error),
    };
  }
};

// Eliminar perfil de empresa
export const deletePerfilEmpresa = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID del perfil de empresa",
      };
      return;
    }

    const existe = await obtenerPerfilEmpresaPorId(id);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "El perfil de empresa no existe",
      };
      return;
    }

    await eliminarPerfilEmpresaModel(id);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Perfil de empresa eliminado correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al eliminar el perfil de empresa: " + String(error),
    };
  }
};