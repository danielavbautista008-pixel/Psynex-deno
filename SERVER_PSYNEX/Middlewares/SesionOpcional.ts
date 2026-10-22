import type { Context, Next } from "../Dependencies/dependencias.ts";
import { VerificarTokenAcceso } from "../Helpers/Jwt.ts";
import { UsuarioModel } from "../Model/Administrador/UsuarioModel.ts";

// Para las rutas PÚBLICAS (Explorar): si el visitante tiene sesión, la
// reconoce y deja ctx.state.usuario = { id, rol }; si no la tiene, la
// petición sigue igual (nunca responde 401).
// Sirve, por ejemplo, para marcar "ya te postulaste" o para guardar el
// resultado de un cuestionario solo cuando hay un paciente con sesión.
export const sesionOpcional = async (ctx: Context, next: Next) => {
  try {
    const token =
      (await ctx.cookies.get("token")) ??
      ctx.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

    if (token) {
      const payload = await VerificarTokenAcceso(token);
      const sub = typeof payload?.sub === "string" ? payload.sub : null;
      if (sub) {
        const usuario = await UsuarioModel.buscarPorId(sub);
        if (usuario && usuario.EstadoActivo) {
          ctx.state.usuarioId = usuario.UsuarioId;
          ctx.state.usuario = { id: usuario.UsuarioId, rol: usuario.Rol, nombre: usuario.NombreCompleto };
        }
      }
    }
  } catch (error) {
    // Un token dañado no debe romper una página pública
    console.error("sesionOpcional:", error);
  }
  await next();
};
