import { Router } from "../Dependencies/dependencias.ts";
import {
  registrar,
  registrarPsicologo,
  registrarEmpresa,
  login,
  logout,
  perfil,
  solicitarRecuperacion,
  validarRecuperacion,
  restablecerPassword,
} from "../Controller/AuthController.ts";
import { requireAuth } from "../Middlewares/RequireAuth.ts";
import { requiereRol } from "../Middlewares/RequiereRol.ts";
import { EmailService } from "../Helpers/EmailService.ts";

const router = new Router({ prefix: "/api/auth" });

router.post("/register", registrar);
router.post("/registro/psicologo", registrarPsicologo); // multipart con documentos
router.post("/registro/empresa", registrarEmpresa); // multipart con RUT y Cámara de Comercio
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, perfil); // ruta protegida

// Recuperar contraseña (públicas: la persona no tiene sesión)
router.post("/recuperar", solicitarRecuperacion); // { email } -> envía el correo
router.get("/recuperar/validar", validarRecuperacion); // ?token=... -> ¿el enlace sirve?
router.post("/restablecer", restablecerPassword); // { token, password } -> cambia la contraseña



// Prueba de envío de correos: solo el Administrador puede usarla
// (antes era pública y cualquiera podía enviar correos desde la cuenta de Psynex).
router.post("/test-email", requireAuth, requiereRol("Admin"), async (ctx) => {
  const body = await ctx.request.body.json().catch(() => ({}));
  const to = body.to;
  const tipo = body.tipo ?? "bienvenida";
  const rol = body.rol ?? "Paciente";

  if (!to) {
    ctx.response.status = 400;
    ctx.response.body = { ok: false, error: "Falta 'to'" };
    return;
  }

  try {
    if (tipo === "bienvenida") {
      await EmailService.enviarBienvenida({
        to,
        nombreCompleto: body.nombre ?? "Usuario Prueba",
        rol,
      });
    } else if (tipo === "recuperacion") {
      await EmailService.enviarRecuperacionPassword({
        to,
        nombre: body.nombre ?? "Usuario",
        enlaceRecuperacion: `${Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321"}/recuperar?token=prueba`,
        minutos: 30,
      });
    } else if (tipo === "cita") {
      await EmailService.enviarAceptacionCita({
        to,
        nombreUsuario: body.nombre ?? "Usuario",
        nombrePsicologo: "Víctor Santiago",
        fecha: "10/10/2026",
        hora: "10:00 a. m.",
        modalidad: "Virtual",
      });
    } else {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "tipo inválido" };
      return;
    }

    ctx.response.body = { ok: true, mensaje: `Correo (${tipo}) enviado a ${to}` };
  } catch (e) {
    console.error(e);
    ctx.response.status = 500;
    ctx.response.body = { ok: false, error: String(e) };
  }
});

export default router;