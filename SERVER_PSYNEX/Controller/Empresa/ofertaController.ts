import { Context } from "../Dependencies/dependencias.ts";
import { OfertaLaboral, OfertaLaboralData } from "../Model/ofertaLaboralModel.ts";

// GET /ofertaslaborales
export const getOfertas = async (ctx: Context) => {
    const { response } = ctx;
    try {
        const ObjOferta = new OfertaLaboral();
        const listaOfertas = await ObjOferta.SeleccionarOfertasLaborales();
        response.status = 200;
        response.body = {
            success: true,
            data: listaOfertas,
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

// GET /ofertaslaborales/empresa/:perfileId
export const getOfertasPorEmpresa = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjOferta = new OfertaLaboral();
        const ofertas = await ObjOferta.SeleccionarPorEmpresa(params.perfileId!);
        response.status = 200;
        response.body = {
            success: true,
            data: ofertas,
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

// GET /ofertaslaborales/empresa/:perfileId/contar
export const contarOfertasActivasPorEmpresa = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjOferta = new OfertaLaboral();
        const conteo = await ObjOferta.ContarOfertasActivasPorEmpresa(params.perfileId!);
        response.status = 200;
        response.body = {
            success: true,
            data: conteo,
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

// GET /ofertaslaborales/publicos
export const getPublicos = async (ctx: Context) => {
    const { response } = ctx;
    try {
        const ObjOferta = new OfertaLaboral();
        const ofertas = await ObjOferta.SeleccionarPublicas();
        response.status = 200;
        response.body = {
            success: true,
            data: ofertas,
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

// POST /ofertaslaborales
export const postOferta = async (ctx: Context) => {
    const { request, response } = ctx;
    try {
        const body = request.body();
        const dto: OfertaLaboralData = await body.value;

        const ObjOferta = new OfertaLaboral();
        const nuevaOferta = await ObjOferta.InsertarOferta(dto);

        response.status = 200;
        response.body = {
            success: true,
            data: nuevaOferta,
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

// PUT /ofertaslaborales/:id
export const putOferta = async (ctx: Context) => {
    const { request, response, params } = ctx;
    try {
        const body = request.body();
        const dto: OfertaLaboralData = await body.value;

        const ObjOferta = new OfertaLaboral();
        const ofertaExistente = await ObjOferta.SeleccionarPorId(params.id!);

        if (!ofertaExistente) {
            response.status = 404;
            response.body = {
                success: false,
                message: "Oferta no encontrada",
            };
            return;
        }

        const actualizado = await ObjOferta.ActualizarOferta(params.id!, dto);

        if (actualizado) {
            response.status = 200;
            response.body = {
                success: true,
                message: "Oferta actualizada exitosamente",
            };
        } else {
            response.status = 400;
            response.body = {
                success: false,
                message: "Error de concurrencia al actualizar la oferta",
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

// DELETE /ofertaslaborales/:id
export const deleteOferta = async (ctx: Context) => {
    const { response, params } = ctx;
    try {
        const ObjOferta = new OfertaLaboral();
        const ofertaExistente = await ObjOferta.SeleccionarPorId(params.id!);

        if (!ofertaExistente) {
            response.status = 404;
            response.body = {
                success: false,
                message: "Oferta no encontrada",
            };
            return;
        }

        await ObjOferta.DesactivarOferta(params.id!);

        response.status = 200;
        response.body = {
            success: true,
            message: "Oferta desactivada exitosamente",
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