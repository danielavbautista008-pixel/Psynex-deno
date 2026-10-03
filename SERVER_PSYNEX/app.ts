import { Application, oakCors } from "./Dependencies/dependencias.ts";
import authRoutes from "./Routes/AuthRoutes.ts";
import usuarioRoutes from "./Routes/Administrador/UsuarioRoutes.ts";
import  CuestionariosRouter  from "./Routes/Administrador/CuestionariosRoutes.ts";
import EstadisticasRoutes from "./Routes/Administrador/EstadisticasRoutes.ts";
import CitasRouter from "./Routes/Administrador/CitasRoutes.ts";


const app = new Application();

app.use(oakCors({
    origin: "http://localhost:4321", // el origen de tu frontend (Astro)
    credentials: true,               // necesario para que viajen las cookies
}));

// Manejo de errores global: si algo lanza una excepción, responde 500 en JSON
// en vez de dejar la petición colgada.
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (error) {
        console.error("Error no controlado:", error);
        ctx.response.status = 500;
        ctx.response.body = { ok: false, mensaje: "Error interno del servidor" };
    }
});

const routes = [authRoutes, usuarioRoutes, CuestionariosRouter, EstadisticasRoutes, CitasRouter];
routes.forEach((router) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
});

console.log("Servidor corriendo por el puerto 8001");
await app.listen({ port: 8001 });