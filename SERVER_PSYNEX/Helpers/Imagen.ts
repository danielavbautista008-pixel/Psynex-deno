import type { Context } from "../Dependencies/dependencias.ts";

// =====================================================================
// Envía una foto (de perfil, logo...) sin que el navegador se quede con
// una versión vieja.
//
// Antes las fotos se guardaban 1 hora en la caché del navegador, así que
// al cambiar la foto se seguía viendo la anterior en Explorar, el chat...
// Ahora el navegador pregunta siempre si cambió ("no-cache"): si es la
// misma (mismo ETag) el servidor responde 304 sin volver a mandarla; si
// cambió, manda la nueva.
// =====================================================================
export async function responderImagen(
  ctx: Context,
  img: { mime: string; bytes: Uint8Array },
  publica = false,
) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", new Uint8Array(img.bytes)));
  const etag = `"${[...hash].map((b) => b.toString(16).padStart(2, "0")).join("")}"`;

  ctx.response.headers.set("Cache-Control", `${publica ? "public" : "private"}, no-cache`);
  ctx.response.headers.set("ETag", etag);
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");

  if (ctx.request.headers.get("If-None-Match") === etag) {
    ctx.response.status = 304; // no cambió: el navegador usa la que ya tiene
    return;
  }
  ctx.response.headers.set("Content-Type", img.mime);
  ctx.response.body = img.bytes;
}
