import type { Context } from "../Dependencies/dependencias.ts";

// Lee el body como JSON. Si viene vacío o mal formado devuelve null
// (así el controlador responde 400 en vez de un error 500).
export async function leerBody(ctx: Context): Promise<unknown | null> {
  try {
    return await ctx.request.body.json();
  } catch {
    return null;
  }
}

// Convierte los errores de Zod en una lista de mensajes para el frontend.
export function erroresZod(error: { issues: { message: string }[] }): string[] {
  return error.issues.map((i) => i.message);
}

// Respuesta de error estándar del proyecto: { ok: false, error }
export function responderError(ctx: Context, status: number, error: string | string[]) {
  ctx.response.status = status;
  ctx.response.body = { ok: false, error };
}
