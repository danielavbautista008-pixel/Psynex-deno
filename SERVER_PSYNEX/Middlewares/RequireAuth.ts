import type { Context, Next } from "../Dependencies/dependencias.ts";
import { z } from "../Dependencies/dependencias.ts";
import { VerificarTokenAcceso } from "../Helpers/Jwt.ts";
import { UsuarioModel } from "../Model/Administrador/UsuarioModel.ts";

// Forma que debe tener el payload del JWT (lo crea CrearToken con "sub").
const PayloadSchema = z.object({
    sub: z.string().min(1),
});

// Protege rutas: acepta el token desde la cookie "token" o desde
// el header "Authorization: Bearer <token>" (lo que Astro reenvíe).
export const requireAuth = async (ctx: Context, next: Next) => {
    const token =
        (await ctx.cookies.get("token")) ??
        ctx.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
        ctx.response.status = 401;
        ctx.response.body = { error: "No autenticado" };
        return;
    }

    const payload = await VerificarTokenAcceso(token);
    if (!payload) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Token inválido o expirado" };
        return;
    }

    const resultado = PayloadSchema.safeParse(payload);
    if (!resultado.success) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Token con formato inválido" };
        return;
    }

    try {
        // El token prueba QUIÉN es; el rol se consulta en la base de datos
        // porque puede cambiar sin que el usuario vuelva a iniciar sesión.
        const usuario = await UsuarioModel.buscarPorId(resultado.data.sub);
        if (!usuario || !usuario.EstadoActivo) {
            ctx.response.status = 401;
            ctx.response.body = { error: "Cuenta no encontrada o inactiva" };
            return;
        }

        ctx.state.usuarioId = usuario.UsuarioId;
        ctx.state.usuario = { id: usuario.UsuarioId, rol: usuario.Rol };
    } catch (error) {
        console.error("Error en requireAuth:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Error interno del servidor" };
        return;
    }

    await next();
};