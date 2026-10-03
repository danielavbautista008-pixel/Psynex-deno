import type { Context, Next } from "../Dependencies/dependencias.ts";
// Uso en las rutas (siempre después de requireAuth):
//   router.get("/usuarios", requireAuth, requiereRol("Admin"), UsuarioController.listar);
//   router.get("/citas", requireAuth, requiereRol("Psicologo", "Admin"), listarCitas);
export const requiereRol = (...rolesPermitidos: string[]) => {
    return async (ctx: Context, next: Next) => {
        const usuario = ctx.state.usuario;

        // requireAuth debe haber corrido antes y guardado ctx.state.usuario
        if (!usuario) {
            ctx.response.status = 401;
            ctx.response.body = { error: "No autenticado" };
            return;
        }

        if (!rolesPermitidos.includes(usuario.rol)) {
            ctx.response.status = 403;
            ctx.response.body = { error: "No tienes permiso para esta acción" };
            return;
        }

        await next();
    };
};