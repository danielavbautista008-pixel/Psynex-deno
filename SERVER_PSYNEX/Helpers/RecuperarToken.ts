// =====================================================================
// Helpers/RecuperarToken.ts
// Token del enlace "Recuperar contraseña" que llega por correo.
//
// No se guarda en la base de datos: es un JWT firmado que lleva
//   - sub: el id del usuario
//   - ph:  una "huella" de su contraseña actual (no la contraseña)
//   - exp: vence a los 30 minutos
// Cuando la persona cambia la contraseña, la huella ya no coincide y el
// enlace deja de servir (solo se puede usar una vez).
//
// Se firma con una clave DISTINTA a la de la sesión, para que este token
// nunca se pueda usar como cookie de inicio de sesión.
// =====================================================================
import { create, getNumericDate, verify } from "../Dependencies/dependencias.ts";
import { generateKey } from "./CriptoKey.ts";

const base = Deno.env.get("MY_SECRET_KEY");
if (!base) throw new Error("Falta la variable de entorno MY_SECRET_KEY");

const clave = await generateKey(`${base}:recuperar-password`);

export const MINUTOS_RECUPERACION = 30;

// Huella de la contraseña: un resumen SHA-256 del hash guardado
export const huellaPassword = async (passwordHash: string): Promise<string> => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordHash));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
};

export const crearTokenRecuperacion = async (usuarioId: string, passwordHash: string) =>
  await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: usuarioId,
      ph: await huellaPassword(passwordHash),
      uso: "recuperar",
      exp: getNumericDate(MINUTOS_RECUPERACION * 60),
    },
    clave,
  );

// Devuelve { usuarioId, huella } si el token es válido y no ha vencido; si no, null
export const leerTokenRecuperacion = async (token: string) => {
  try {
    const p = await verify(token, clave);
    if (p.uso !== "recuperar" || typeof p.sub !== "string" || typeof p.ph !== "string") return null;
    return { usuarioId: p.sub, huella: p.ph };
  } catch {
    return null;
  }
};
