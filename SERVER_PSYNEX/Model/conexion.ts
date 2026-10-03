import { Client } from "../Dependencies/dependencias.ts";

export const conexion = await new Client().connect({
    hostname: "127.0.0.1",
    username: "root",
    db: "psynex",
    password: "",
})