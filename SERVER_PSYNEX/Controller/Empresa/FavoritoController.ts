import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarEstadoFavoritoModel,
  agregarFavoritoModel,
  eliminarFavoritoModel,
  obtenerFavoritosPorPerfilId,
  obtenerTodosFavoritos,
} from "../../Model/Empresa/Favoritos.ts";

// Listar todos los favoritos
export const getFavoritos = async (ctx: Context) => {
  try {
    const favoritos = await obtenerTodosFavoritos();
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: favoritos,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener la lista de favoritos",
      error: String(error),
    };
  }
};

// Obtener favoritos por ID de Perfil Empresa
export const getFavoritosPorPerfilId = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { perfileId } = ctx.params;
    const favoritos = await obtenerFavoritosPorPerfilId(perfileId);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: favoritos,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener los favoritos del perfil",
      error: String(error),
    };
  }
};

// Agregar un nuevo favorito
export const postFavorito = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();

    if (!body.PerfileId || !body.PerfilId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan campos obligatorios (PerfileId, PerfilId)",
      };
      return;
    }

    const nuevoFavorito = {
      ...body,
      estado: body.estado !== undefined ? body.estado : true,
    };

    const resultado = await agregarFavoritoModel(nuevoFavorito);

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Favorito agregado exitosamente",
      data: resultado,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al agregar el favorito",
      error: String(error),
    };
  }
};

// Actualizar únicamente el estado del favorito
export const patchEstadoFavorito = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;
    const body = await ctx.request.body.json();

    if (body.estado === undefined) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el campo 'estado' para realizar la actualización",
      };
      return;
    }

    await actualizarEstadoFavoritoModel(id, body.estado);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Estado del favorito actualizado correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el estado del favorito",
      error: String(error),
    };
  }
};

// Eliminar un favorito por ID
export const deleteFavorito = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { id } = ctx.params;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID del favorito",
      };
      return;
    }

    await eliminarFavoritoModel(id);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Favorito eliminado correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al eliminar el favorito: " + String(error),
    };
  }
};