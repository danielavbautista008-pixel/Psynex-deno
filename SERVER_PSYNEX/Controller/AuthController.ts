import type { RouterContext } from "../Dependencies/dependencias.ts";
import { hash, compare } from "../Dependencies/dependencias.ts";
import { registroSchema, loginSchema } from "../Validators/AuthValidator.ts";
import { buscarPorEmail, buscarPorId, crearUsuario, sinPassword } from "../Model/UsuarioModel.ts";
import { CrearToken } from "../Helpers/Jwt.ts"

// Guarda el token en una cookie segura
const ponerCookie = async (ctx: RouterContext<string>, userId: string) => {
    const token = await CrearToken(userId);
    await ctx.cookies.set("token", token, {
        httpOnly: true,   // JavaScript del navegador no puede leerla
        sameSite: "lax",  // protege contra peticiones desde otros sitios
        maxAge: 60 * 60,  // dura 1 hora (en segundos), igual que el exp del token
        path: "/",
    });
};

export const registrar = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = registroSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const datos = validacion.data;

    if (await buscarPorEmail(datos.email)) {
        ctx.response.status = 409;
        ctx.response.body = { error: "Ese email ya está registrado" };
        return;
    }

    const id = await crearUsuario({
        nombreCompleto: datos.nombreCompleto,
        fechaNacimiento: datos.fechaNacimiento,
        rol: datos.rol,
        email: datos.email,
        passwordHash: await hash(datos.password),
    });

    await ponerCookie(ctx, id);
    ctx.response.status = 201;
    ctx.response.body = { mensaje: "Usuario creado", usuarioId: id };
};

export const login = async (ctx: RouterContext<string>) => {
    const body = await ctx.request.body.json().catch(() => null);
    const validacion = loginSchema.safeParse(body);
    if (!validacion.success) {
        ctx.response.status = 400;
        ctx.response.body = { error: validacion.error.issues.map((i) => i.message) };
        return;
    }
    const { email, password } = validacion.data;

    const usuario = await buscarPorEmail(email);
    if (!usuario || usuario.EstadoActivo !== 1 || !(await compare(password, usuario.PasswordHash))) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Credenciales incorrectas" };
        return;
    }

    await ponerCookie(ctx, usuario.UsuarioId);
    ctx.response.body = { mensaje: "Sesión iniciada", usuario: sinPassword(usuario) };
};

export const logout = async (ctx: RouterContext<string>) => {  //logout: Elimina la cookie del token enviando la orden al navegador.
    await ctx.cookies.delete("token");
    ctx.response.body = { mensaje: "Sesión cerrada" };
};

export const perfil = async (ctx: RouterContext<string>) => {
    const usuario = await buscarPorId(ctx.state.usuarioId);
    if (!usuario) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Usuario no encontrado" };
        return;
    }
    ctx.response.body = { usuario: sinPassword(usuario) };
};