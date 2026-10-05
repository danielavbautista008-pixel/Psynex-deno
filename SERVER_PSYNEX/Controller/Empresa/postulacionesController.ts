import { Context } from "../Dependencies/dependencias.ts";
import { Postulacion, PostulacionData } from "../Model/postulacionModel.ts";

// GET /postulaciones/usuario/:usuarioId
export const getPorUsuario = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjPostulacion = new Postulacion();
        const lista = await ObjPostulacion.SeleccionarPorUsuario(params.usuarioId!);
        response.status = 200;
        response.body = {
            success: true,
            data: lista,
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

// GET /postulaciones/empresa/:perfileId
export const getPorEmpresa = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjPostulacion = new Postulacion();
        const lista = await ObjPostulacion.SeleccionarPorEmpresa(params.perfileId!);
        response.status = 200;
        response.body = {
            success: true,
            data: lista,
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

// POST /postulaciones
export const postularse = async (ctx: Context) => {
    const { request, response } = ctx;
    try {
        const body = request.body();
        const dto: PostulacionData = await body.value;

        if (!dto || !dto.ofertaId || !dto.usuarioId) {
            response.status = 400;
            response.body = {
                success: false,
                message: "Datos de postulación no válidos.",
            };
            return;
        }

        const ObjPostulacion = new Postulacion();

        const yaExiste = await ObjPostulacion.ExistePostulacion(dto.ofertaId, dto.usuarioId);
        if (yaExiste) {
            response.status = 400;
            response.body = {
                success: false,
                message: "Ya te has postulado previamente a esta oferta laboral.",
            };
            return;
        }

        const nuevaPostulacion = await ObjPostulacion.InsertarPostulacion(dto);

        response.status = 200;
        response.body = {
            success: true,
            data: nuevaPostulacion,
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

// PUT /postulaciones/:id
export const putPostulacion = async (ctx: Context) => {
    const { request, response, params } = ctx;
    try {
        const body = request.body();
        const dto: Partial<PostulacionData> = await body.value;

        const ObjPostulacion = new Postulacion();
        const existente = await ObjPostulacion.SeleccionarPorId(params.id!);

        if (!existente) {
            response.status = 404;
            response.body = {
                success: false,
                message: "Postulación no encontrada",
            };
            return;
        }

        await ObjPostulacion.ActualizarPostulacion(params.id!, dto);

        response.status = 200;
        response.body = {
            success: true,
            message: "Postulación actualizada exitosamente",
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

// DELETE /postulaciones/:id
export const deletePostulacion = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjPostulacion = new Postulacion();
        const existente = await ObjPostulacion.SeleccionarPorId(params.id!);

        if (!existente) {
            response.status = 404;
            response.body = {
                success: false,
                message: "Postulación no encontrada",
            };
            return;
        }

        await ObjPostulacion.EliminarPostulacion(params.id!);

        response.status = 200;
        response.body = {
            success: true,
            message: "Postulación eliminada exitosamente",
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