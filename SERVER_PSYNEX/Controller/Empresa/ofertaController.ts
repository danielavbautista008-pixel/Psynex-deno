import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarOfertaModel,
  contarOfertasActivasPorEmpresa,
  crearOfertaModel,
  desactivarOfertaModel,
  eliminarOfertaModel,
  obtenerOfertaPorId,
  obtenerOfertasPorEmpresa,
  obtenerOfertasPublicas,
  obtenerTodasOfertas,
} from "../../Model/Empresa/ofertaModel.ts";

// Listar todas las ofertas activas
export const getOfertas = async (ctx: Context) => {
  try {
    const ofertas = await obtenerTodasOfertas();
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: ofertas,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener la lista de ofertas laborales",
      error: String(error),
    };
  }
};

// Obtener una sola oferta por su ID
export const getOfertaById = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { OfertaId } = ctx.params;
    const oferta = await obtenerOfertaPorId(OfertaId);

    if (!oferta) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "Oferta laboral no encontrada",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: oferta };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al buscar la oferta laboral",
      error: String(error),
    };
  }
};

// Obtener ofertas por ID de empresa (Perfil)
export const getOfertasByEmpresa = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { PerfileId } = ctx.params;
    const ofertas = await obtenerOfertasPorEmpresa(PerfileId);

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: ofertas };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener ofertas de la empresa",
      error: String(error),
    };
  }
};

// Contar ofertas activas de una empresa
export const getContarOfertasEmpresa = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { PerfileId } = ctx.params;
    const total = await contarOfertasActivasPorEmpresa(PerfileId);

    ctx.response.status = 200;
    ctx.response.body = { success: true, total };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al contar las ofertas de la empresa",
      error: String(error),
    };
  }
};

// Obtener ofertas destacadas públicas (Límite 3)
export const getOfertasPublicas = async (ctx: Context) => {
  try {
    const ofertas = await obtenerOfertasPublicas();
    ctx.response.status = 200;
    ctx.response.body = { success: true, data: ofertas };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener las ofertas públicas",
      error: String(error),
    };
  }
};

// Crear nueva oferta laboral
export const postOferta = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();

    if (!body.PerfileId || !body.Titulo) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan campos obligatorios para registrar la oferta (PerfileId, Titulo)",
      };
      return;
    }

    const idCreado = await crearOfertaModel(body);

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Oferta laboral creada exitosamente",
      ofertaId: idCreado,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al crear la oferta laboral",
      error: String(error),
    };
  }
};

// Actualizar oferta laboral
export const putOferta = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { OfertaId } = ctx.params;
    const body = await ctx.request.body.json();

    const existe = await obtenerOfertaPorId(OfertaId);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "La oferta laboral no existe",
      };
      return;
    }

    await actualizarOfertaModel(OfertaId, body);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Oferta laboral actualizada correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar la oferta laboral",
      error: String(error),
    };
  }
};

// Desactivar o Cerrar oferta laboral
export const patchDesactivarOferta = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { OfertaId } = ctx.params;

    const existe = await obtenerOfertaPorId(OfertaId);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "La oferta laboral no existe",
      };
      return;
    }

    await desactivarOfertaModel(OfertaId);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Oferta laboral cerrada exitosamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al cerrar la oferta laboral",
      error: String(error),
    };
  }
};

// Eliminar definitivamente oferta laboral
export const deleteOferta = async (ctx: Context) => {
  try {
    // @ts-ignore
    const { OfertaId } = ctx.params;

    if (!OfertaId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID de la oferta",
      };
      return;
    }

    const existe = await obtenerOfertaPorId(OfertaId);
    if (!existe) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "La oferta laboral no existe",
      };
      return;
    }

    await eliminarOfertaModel(OfertaId);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Oferta laboral eliminada correctamente",
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error interno en el servidor: " + String(error),
    };
  }
};