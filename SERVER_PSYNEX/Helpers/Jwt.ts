import { create, verify, getNumericDate } from "../Dependencies/dependencias.ts";
import { generateKey } from "./CriptoKey.ts";

// La clave secreta viene de una variable de entorno.
// Si falta, el servidor no arranca (así nunca se usa una clave adivinable).
const key = Deno.env.get("MY_SECRET_KEY");
if (!key) {
    throw new Error("Falta la variable de entorno MY_SECRET_KEY");
}

const server = Deno.env.get("SERVER");

// Se crea una sola vez al arrancar el servidor, no en cada petición.
const secretKey = await generateKey(key);

// Crea un token que dura 1 hora.
// "sub" guarda el id del usuario; es el campo que lee requireAuth.
export const CrearToken = async (userId: string) => {
    const payload = {
        iss: server,
        sub: userId,
        jti: crypto.randomUUID(),
        exp: getNumericDate(60 * 60),
    };

    return await create({ alg: "HS256", typ: "JWT" }, payload, secretKey);
};

// Devuelve el payload si el token es válido; null si es inválido o expiró.
export const VerificarTokenAcceso = async (token: string) => {
    try {
        return await verify(token, secretKey);
    } catch (error) {
        console.error("Token inválido:", error);
        return null;
    }
};