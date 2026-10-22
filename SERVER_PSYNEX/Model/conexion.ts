import { Client } from "../Dependencies/dependencias.ts";

// Conexión a MySQL/MariaDB (XAMPP).
// Los datos vienen del archivo .env; si alguno falta se usan los valores
// por defecto de XAMPP, así el proyecto sigue funcionando igual que antes.
export const conexion = await new Client().connect({
    hostname: Deno.env.get("DB_HOST") ?? "127.0.0.1",
    port: Number(Deno.env.get("DB_PORT") ?? 3306),
    username: Deno.env.get("DB_USER") ?? "root",
    password: Deno.env.get("DB_PASSWORD") ?? "",
    db: Deno.env.get("DB_NAME") ?? "psynex",
});
