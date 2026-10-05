import { Context } from "../Dependencies/dependencias.ts";
import { PerfilEmpresa } from "../Model/perfilEmpresaModel.ts";

export const getPerfilEmpresa = async (ctx: Context) => {
    const { response } = ctx;

    try {
        const ObjPerfil = new PerfilEmpresa();
        const ListaPerfiles = await ObjPerfil.SeleccionarPerfilesEmpresa();
        response.status = 200;
        response.body = {
            success: true,
            data: ListaPerfiles,
        };
    } catch (error) {
        response.status = 400;
        response.body = {
            success: false,
            message: "error al procesar la solicitud",
            errors: error,
        };
    }
};

export const getPerfilEmpresaPorId = async (ctx: Context) => {
    const { response, params } = ctx;

    try {
        const ObjPerfil = new PerfilEmpresa();
        const perfil = await ObjPerfil.SeleccionarPorId(params.id!);

        if (!perfil) {
            response.status = 404;
            response.body = {
                success: false,
                message: `No se encontró el perfil de empresa con ID ${params.id}`,
            };
            return;
        }

        response.status = 200;
        response.body = {
            success: true,
            data: perfil,
        };
    } catch (error) {
        response.status = 400;
        response.body = {
            success: false,
            message: "error al procesar la solicitud",
            errors: error,
        };
    }
};

export const getPerfilEmpresaPorUsuarioId = async (ctx: Context) => {
    const { response, params } = ctx;

    try {
        const ObjPerfil = new PerfilEmpresa();
        const perfil = await ObjPerfil.SeleccionarPorUsuarioId(params.usuarioId!);

        if (!perfil) {
            response.status = 404;
            response.body = {
                success: false,
                message: `No se encontró un perfil de empresa asociado al usuario con ID ${params.usuarioId}`,
            };
            return;
        }

        response.status = 200;
        response.body = {
            success: true,
            data: perfil,
        };
    } catch (error) {
        response.status = 400;
        response.body = {
            success: false,
            message: "error al procesar la solicitud",
            errors: error,
        };
    }
};

export const putPerfilEmpresa = async (ctx: Context) => {
    const { request, response, params } = ctx;

    try {
        const body = request.body();
        const datos = await body.value;

        if (datos.perfileId && params.id !== datos.perfileId) {
            response.status = 400;
            response.body = {
                success: false,
                message: "El ID proporcionado en la URL no coincide con el ID de la empresa enviada.",
            };
            return;
        }

        const ObjPerfil = new PerfilEmpresa();
        const perfilExistente = await ObjPerfil.SeleccionarPorId(params.id!);

        if (!perfilExistente) {
            response.status = 404;
            response.body = {
                success: false,
                message: `No se encontró el perfil de empresa con ID ${params.id} para actualizar.`,
            };
            return;
        }

        const actualizado = await ObjPerfil.ActualizarPerfilEmpresa(params.id!, datos);

        if (actualizado) {
            response.status = 200;
            response.body = {
                success: true,
                message: "Perfil de empresa actualizado correctamente",
            };
        } else {
            response.status = 404;
            response.body = {
                success: false,
                message: "La empresa ya no existe en el sistema.",
            };
        }
    } catch (error) {
        response.status = 400;
        response.body = {
            success: false,
            message: "error al procesar la solicitud",
            errors: error,
        };
    }
};

export const postPerfilEmpresa = async (ctx: Context) => {
    const { response } = ctx;
};

export const deletePerfilEmpresa = async (ctx: Context) => {
    const { response } = ctx;
};