export async function generateKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        "raw",                             //formato de entrada secuencial de bytes sin codificar
        new TextEncoder().encode(secret),  // convierte la clave en un Uint8Array entendible para el importKey
        { name: "HMAC", hash: "SHA-256" }, //define el algoritmo para HMAC crea una clave con formato SHA-256
        false,                             // define si la clave puede ser importada despues de creada 
        ["sign", "verify"]                 // define para que puede ser usada la clave sing = firmar y verify = verificar la firma del token
        
    )
  
}