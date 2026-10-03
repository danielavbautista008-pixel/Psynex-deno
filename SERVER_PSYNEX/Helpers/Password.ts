import { hash, compare } from "../Dependencies/dependencias.ts";

// Convierte la contraseña en un hash para guardarlo en la base de datos.
// Sin segundo parámetro, la librería genera el salt automáticamente.
export async function hashPassword(password: string): Promise<string> {
    return await hash(password);
}

// Compara la contraseña que escribe el usuario contra el hash guardado.
// Si el hash no es válido o la librería falla, devuelve false (no un error 500),
// pero el error real se imprime en la terminal para poder encontrar la causa.
export async function compararPassword(
    password: string,
    passwordHash: string,
): Promise<boolean> {
    try {
        return await compare(password, passwordHash);
    } catch (error) {
        console.error("Error al comparar la contraseña:", error);
        return false;
    }
}