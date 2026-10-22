import type { Context, Next } from "../Dependencies/dependencias.ts";
import { obtenerPerfilPsicologo } from "../Helpers/PsicologoAuth.ts";

// Uso en las rutas del psicólogo (siempre después de requireAuth y requiereRol):
//   router.get("/", requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo, Controller.listar);
//
// Busca el perfil del psicólogo que inició sesión y lo deja en
// ctx.state.perfilPsicologo, para que los controladores no tengan que
// repetir esa consulta. Si el usuario no tiene perfil, responde 403.
export const requierePerfilPsicologo = async (ctx: Context, next: Next) => {
  const usuarioId = String(ctx.state.usuarioId ?? ctx.state.usuario?.id ?? "");

  try {
    const perfil = await obtenerPerfilPsicologo(usuarioId);
    if (!perfil) {
      ctx.response.status = 403;
      ctx.response.body = { ok: false, error: "No tienes perfil de psicólogo" };
      return;
    }
    ctx.state.perfilPsicologo = perfil;
  } catch (error) {
    console.error("Error en requierePerfilPsicologo:", error);
    ctx.response.status = 500;
    ctx.response.body = { ok: false, error: "Error interno del servidor" };
    return;
  }

  await next();
};
