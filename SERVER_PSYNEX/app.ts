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
// ----------------------- Sala de videollamada -----------------------
import SalaRoutes from "./Routes/Sala/SalaRoutes.ts";
// ----------------------- Beneficio empresarial -----------------------
import BeneficioRoutes from "./Routes/Beneficio/BeneficioRoutes.ts";
// ----------------------- Paciente: cuestionarios asignados (cambio: nuevo) -----------------------
import CuestionariosPacienteRoutes from "./Routes/Paciente/CuestionariosPacienteRoutes.ts";
// ----------------------- Paciente: mi perfil (cambio: nuevo) -----------------------
import PerfilPacienteRoutes from "./Routes/Paciente/PerfilPacienteRoutes.ts";
// ----------------------- Paciente: beneficio de la empresa (cambio: nuevo) -----------------------
import BeneficioPacienteRoutes from "./Routes/Paciente/BeneficioPacienteRoutes.ts";
// ----------------------- Paciente: inicio, registro diario, cancelar y calificar citas (cambio: nuevo) -----------------------
import PanelPacienteRoutes from "./Routes/Paciente/PanelPacienteRoutes.ts";
// ----------------------- Empresa: perfil, inicio, ofertas y favoritos (carpeta empresa.e) -----------------------
import PanelEmpresaRoutes from "./Routes/empresa.e/PanelEmpresaRoutes.ts";
// ----------------------- Recordatorios automáticos de citas (cambio: nuevo) -----------------------
import { iniciarRecordatorios } from "./Helpers/Recordatorios.ts";
// ----------------------- Empresa: postulaciones (cambio: nuevo) -----------------------
import PostulacionesEmpresaRoutes from "./Routes/Empresa/PostulacionesEmpresaRoutes.ts";
// ----------------------- Pagos del paciente con Wompi (cambio: nuevo) -----------------------
import PagosWompiRoutes from "./Routes/Pagos/PagosWompiRoutes.ts";
// ----------------------- Administrador: campanita de tareas pendientes (cambio: nuevo) -----------------------
import PendientesAdminRoutes from "./Routes/Administrador/PendientesAdminRoutes.ts";

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
    // Sala de videollamada (WebRTC)
    SalaRoutes,
    // Beneficio empresarial (planes para trabajadores)
    BeneficioRoutes,
    // Paciente: cuestionarios que le asignaron (cambio: nuevo, solo lectura)
    CuestionariosPacienteRoutes,
    // Paciente: mi perfil con foto (cambio: nuevo)
    PerfilPacienteRoutes,
    // Paciente: código de su empresa y sesiones cubiertas (cambio: nuevo)
    BeneficioPacienteRoutes,
    // Paciente: inicio, registro diario, cancelar y calificar citas (cambio: nuevo)
    PanelPacienteRoutes,
    // Empresa: perfil, inicio, ofertas y favoritos (carpeta empresa.e)
    PanelEmpresaRoutes,
    // Empresa: ver postulaciones a sus ofertas (cambio: nuevo, solo lectura)
    PostulacionesEmpresaRoutes,
    // Pagos del paciente: citas y paquetes con Wompi (cambio: nuevo)
    PagosWompiRoutes,
    // Administrador: tareas pendientes para su campanita (cambio: nuevo)
    PendientesAdminRoutes,
];
routes.forEach((router) => {
    app.use(router.routes());
    app.use(router.allowedMethods());
});

// cambio: revisa cada 15 minutos las citas de las próximas 24 horas y manda los recordatorios
iniciarRecordatorios();

console.log(`Servidor corriendo por el puerto ${PUERTO}`);
await app.listen({ port: PUERTO });
