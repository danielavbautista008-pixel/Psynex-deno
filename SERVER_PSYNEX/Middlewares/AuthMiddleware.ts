import type { Context, Next } from "../Dependencies/dependencias.ts";
import { VerificarTokenAcceso } from "../Helpers/Jwt.ts"; // usa el nombre real de tu archivo

export const requireAuth = async (ctx: Context, next: Next) => {  //async (ctx: Context, next: Next): Recibe el contexto de la petición (ctx) y la función next, que sirve para darle paso al siguiente middleware o controlador si todo sale bien.
    const token = await ctx.cookies.get("token");  //await ctx.cookies.get("token"): Busca en la petición del cliente si existe la cookie llamada "token".
    if (!token) {                                     //Primer control (if (!token)): Si el usuario no tiene la cookie, detiene la ejecución, asigna el código de estado HTTP 401 (Unauthorized) y responde "No autenticado".
        ctx.response.status = 401;
        ctx.response.body = { error: "No autenticado" };
        return;
    }

    const payload = await VerificarTokenAcceso(token); //VerificarTokenAcceso(...): Pasa el token recibido por la función que desencripta y valida la firma del JWT.
    if (!payload) {                                     //Segundo control (if (!payload)): Si el token fue manipulado, expiró o no es válido, asigna 401 y responde "Token inválido o expirado".
        ctx.response.status = 401;
        ctx.response.body = { error: "Token inválido o expirado" };
        return;
    }

    ctx.state.usuarioId = payload.sub; // lo dejamos disponible para el controlador //ctx.state.usuarioId = payload.sub: Guarda el ID del usuario extraído del token (payload.sub) dentro del estado global de la petición (ctx.state), para que el controlador que viene después sepa qué usuario hizo la solicitud.
    await next();  //await next(): Deja pasar la petición hacia el controlador objetivo
};