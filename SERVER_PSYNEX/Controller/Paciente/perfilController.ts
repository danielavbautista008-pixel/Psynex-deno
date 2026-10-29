import { Context } from "https://deno.land/x/oak/mod.ts";
import { PerfilPaciente, 
        PerfilPacienteData } from "../../Model/Paciente/perfilModel.ts";

// GET /api/perfilpaciente
export const getPerfiles = async (ctx: Context) => {
    try {
        const objPerfil = new PerfilPaciente();
        const perfiles = await objPerfil.SeleccionarPerfilesPacientes();

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: perfiles,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Error al obtener los perfiles de pacientes",
            error: String(error),
        };
    }
};

// GET /api/perfilpaciente/{id} (Busca por UsuarioId)
export const getPerfil = async (ctx: Context) => {
    try {
        // @ts-ignore
        const { id } = ctx.params;
        const objPerfil = new PerfilPaciente();
        const p = await objPerfil.SeleccionarPorUsuarioId(id);

        if (!p) {
            ctx.response.status = 404;
            ctx.response.body = {
                success: false,
                message: "Perfil no encontrado",
            };
            return;
        }

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: p,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Error al buscar el perfil del paciente",
            error: String(error),
        };
    }
};

// POST /api/perfilpaciente
export const crearPerfil = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const dto: PerfilPacienteData = body;

        if (!dto.UsuarioId) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                message: "El campo UsuarioId es obligatorio.",
            };
            return;
        }

        const objPerfil = new PerfilPaciente();

        // Verificar que el usuario existe
        const usuarioExiste = await objPerfil.ExisteUsuario(dto.UsuarioId);
        if (!usuarioExiste) {
            ctx.response.status = 404;
            ctx.response.body = {
                success: false,
                message: "Usuario no encontrado",
            };
            return;
        }

        // Verificar que no tenga ya un perfil
        const perfilExiste = await objPerfil.ExistePerfilPaciente(dto.UsuarioId);
        if (perfilExiste) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                message: "Este usuario ya tiene un perfil",
            };
            return;
        }

        const nuevoPerfil = await objPerfil.InsertarPerfil(dto);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: nuevoPerfil,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Error al crear el perfil del paciente",
            error: String(error),
        };
    }
};

// PUT /api/perfilpaciente/{id} (Actualiza por UsuarioId)
export const actualizarPerfil = async (ctx: Context) => {
    try {
        // @ts-ignore
        const { id } = ctx.params;
        const body = await ctx.request.body.json();

        const objPerfil = new PerfilPaciente();
        const perfilExistente = await objPerfil.SeleccionarPorUsuarioId(id);

        if (!perfilExistente) {
            ctx.response.status = 404;
            ctx.response.body = {
                success: false,
                message: "Perfil no encontrado",
            };
            return;
        }

        await objPerfil.ActualizarPerfil(id, body);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            mensaje: "Perfil actualizado exitosamente",
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Error al actualizar el perfil",
            error: String(error),
        };
    }
};

// POST /api/perfilpaciente/{id}/foto
export const subirFoto = async (ctx: Context) => {
    try {
        // @ts-ignore
        const { id } = ctx.params;
        const body = await ctx.request.body.json();

        if (!body.FotoBase64 || !String(body.FotoBase64).trim()) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                message: "No se recibió ninguna foto.",
            };
            return;
        }

        const objPerfil = new PerfilPaciente();
        const perfilExistente = await objPerfil.SeleccionarPorUsuarioId(id);

        if (!perfilExistente) {
            ctx.response.status = 404;
            ctx.response.body = {
                success: false,
                message: `Perfil no encontrado para usuario ${id}`,
            };
            return;
        }

        await objPerfil.ActualizarFoto(id, body.FotoBase64);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            mensaje: "Foto guardada correctamente",
        };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error?.message,
            detalle: error?.innerException?.message,
        };
    }
};