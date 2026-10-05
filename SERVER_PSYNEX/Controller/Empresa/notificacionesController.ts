import { Context } from "../Dependencies/dependencias.ts";
import { Notificacion, NotificacionData } from "../Model/notificacionModel.ts";

// GET /notificaciones/usuario/:usuarioId
export const getPorUsuario = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjNotificacion = new Notificacion();
        const notificaciones = await ObjNotificacion.SeleccionarPorUsuario(params.usuarioId!);
        
        response.status = 200;
        response.body = {
            success: true,
            data: notificaciones,
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

// POST /notificaciones
export const crearNotificacion = async (ctx: Context) => {
    const { request, response } = ctx;
    try {
        const body = request.body();
        const dto: NotificacionData = await body.value;

        const ObjNotificacion = new Notificacion();
        const nuevaNotificacion = await ObjNotificacion.InsertarNotificacion(dto);

        response.status = 200;
        response.body = {
            success: true,
            data: nuevaNotificacion,
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

// PUT /notificaciones/:id/leer
export const marcarLeida = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjNotificacion = new Notificacion();
        const existe = await ObjNotificacion.SeleccionarPorId(params.id!);

        if (!existe) {
            response.status = 404;
            response.body = {
                success: false,
                message: "Notificación no encontrada",
            };
            return;
        }

        await ObjNotificacion.MarcarComoLeida(params.id!);

        response.status = 200;
        response.body = {
            success: true,
            message: "Notificación marcada como leída",
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