import { Application, oakCors } from "./Dependencies/dependencias.ts";

// ----------------------------- Rutas compartidas -----------------------------
import authRoutes from "./Routes/AuthRoutes.ts";
import NotificacionesRouter from "./Routes/NotificacionesRoutes.ts";

// ------------------------------- Administrador -------------------------------
import usuarioRoutes from "./Routes/Administrador/UsuarioRoutes.ts";
import CuestionariosRouter from "./Routes/Administrador/CuestionariosRoutes.ts";
import EstadisticasRoutes from "./Routes/Administrador/EstadisticasRoutes.ts";
import CitasRouter from "./Routes/Administrador/CitasRoutes.ts";
import PsicologosRouter from "./Routes/Administrador/PsicologosRoutes.ts";
import EmpresasRouter from "./Routes/Administrador/EmpresasRoutes.ts";
import BlogRouter from "./Routes/Administrador/BlogRoutes.ts";
import MetodosPagoRouter from "./Routes/Administrador/MetodosPagoRoutes.ts";
import FinanzasRouter from "./Routes/Administrador/FinanzasRoutes.ts";
import PlanesRouter from "./Routes/Administrador/PlanesRoutes.ts";
import ConfiguracionRouter from "./Routes/Administrador/ConfiguracionRoutes.ts";

// --------------------------------- Psicólogo ---------------------------------
import CitasPsicologoRoutes from "./Routes/Psicologo/CitasPsicologoRoutes.ts";
import PerfilPsicologoRoutes from "./Routes/Psicologo/PerfilPsicologoRoutes.ts";
import PacientesPsicologoRoutes from "./Routes/Psicologo/PacientesPsicologoRoutes.ts";
import AgendaPsicologoRoutes from "./Routes/Psicologo/AgendaPsicologoRoutes.ts";
import AlertasPsicologoRoutes from "./Routes/Psicologo/AlertasPsicologoRoutes.ts";
import CuestionariosPsicologoRoutes from "./Routes/Psicologo/CuestionariosPsicologoRoutes.ts";
import FinanzasPsicologoRoutes from "./Routes/Psicologo/FinanzasPsicologoRoutes.ts";
import OfertasPsicologoRoutes from "./Routes/Psicologo/OfertasPsicologoRoutes.ts";

// ------------------------- Explorar (rutas públicas) -------------------------
import ExplorarRoutes from "./Routes/Explorar/ExplorarRoutes.ts";

// ----------------------- Chat (psicólogo – paciente) -----------------------
import ChatRoutes from "./Routes/Chat/ChatRoutes.ts";

const PUERTO = Number(Deno.env.get("PORT") ?? 8001);
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321";

const app = new Application();

app.use(oakCors({
    origin: FRONTEND_URL,  // el origen de tu frontend (Astro), desde el .env
    credentials: true,     // necesario para que viajen las cookies
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

const routes = [
    // Compartidas
    authRoutes, NotificacionesRouter,
    // Administrador
    usuarioRoutes, CuestionariosRouter, EstadisticasRoutes, CitasRouter, PsicologosRouter,
    EmpresasRouter, BlogRouter, MetodosPagoRouter, FinanzasRouter, PlanesRouter, ConfiguracionRouter,
    // Psicólogo
    CitasPsicologoRoutes, PerfilPsicologoRoutes, PacientesPsicologoRoutes, AgendaPsicologoRoutes,
    AlertasPsicologoRoutes, CuestionariosPsicologoRoutes, FinanzasPsicologoRoutes, OfertasPsicologoRoutes,
    // Explorar (público)
    ExplorarRoutes,
    // Chat (psicólogo – paciente)
    ChatRoutes,
];
routes.forEach((router) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
});

console.log(`Servidor corriendo por el puerto ${PUERTO}`);
await app.listen({ port: PUERTO });
