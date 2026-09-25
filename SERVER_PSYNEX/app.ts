import { Application, oakCors } from "./Dependencies/dependencias.ts";
import authRoutes from "./Routes/AuthRoutes.ts";

const app = new Application();

app.use(oakCors({
   origin: "http://localhost:4321", // el origen de tu frontend
    credentials: true,               // necesario para que viajen las cookies
}));

const routes = [authRoutes];
routes.forEach((router) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
});

console.log("Servidor corriendo por el puerto 8001");
app.listen({ port: 8001 });