export async function generateKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        "raw",                            // formato de entrada: bytes sin codificar
        new TextEncoder().encode(secret), // convierte el texto de la clave en bytes (Uint8Array)
        { name: "HMAC", hash: "SHA-256" },// algoritmo: HMAC con SHA-256
        false,                            // extractable: false = la clave no se puede exportar después (más seguro)
        ["sign", "verify"]                // usos: "sign" para firmar el token, "verify" para verificar su firma
    );
}