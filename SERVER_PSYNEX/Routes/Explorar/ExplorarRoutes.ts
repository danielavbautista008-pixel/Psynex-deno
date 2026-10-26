import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { sesionOpcional } from "../../Middlewares/SesionOpcional.ts";
import { InicioExplorarController } from "../../Controller/Explorar/InicioExplorarController.ts";
import { PsicologosExplorarController } from "../../Controller/Explorar/PsicologosExplorarController.ts";
import { OfertasExplorarController } from "../../Controller/Explorar/OfertasExplorarController.ts";
import { CuestionariosExplorarController } from "../../Controller/Explorar/CuestionariosExplorarController.ts";

// =====================================================================
// Rutas PÚBLICAS de Explorar (no necesitan sesión).
// sesionOpcional: si el visitante tiene sesión la reconoce, si no, sigue.
// Lo único que exige sesión es agendar una cita (solo pacientes).
// =====================================================================
const router = new Router({ prefix: "/api/explorar" });

// Página Explorar (tests, psicólogos y ofertas destacadas)
router.get("/inicio", sesionOpcional, InicioExplorarController.inicio);

// Psicólogos
router.get("/psicologos", PsicologosExplorarController.listar);
router.get("/psicologos/:id", PsicologosExplorarController.perfil);
router.get("/psicologos/:id/foto", PsicologosExplorarController.foto);
router.get("/psicologos/:id/disponibilidad", PsicologosExplorarController.disponibilidad);
router.post("/psicologos/:id/citas", requireAuth, requiereRol("Paciente"), PsicologosExplorarController.agendar);
// Reseñas: solo pacientes con sesión que ya tuvieron una cita con el psicólogo
router.get("/psicologos/:id/mi-resena", requireAuth, requiereRol("Paciente"), PsicologosExplorarController.estadoResena);
router.post("/psicologos/:id/resenas", requireAuth, requiereRol("Paciente"), PsicologosExplorarController.crearResena);

// Ofertas laborales (para postularse se usa /api/psicologo/ofertas/:id/postular)
router.get("/ofertas", sesionOpcional, OfertasExplorarController.listar);
router.get("/ofertas/:id", sesionOpcional, OfertasExplorarController.detalle);
router.get("/empresas/:id/logo", OfertasExplorarController.logo);

// Cuestionarios
router.get("/cuestionarios", CuestionariosExplorarController.listar);
router.get("/cuestionarios/:id", CuestionariosExplorarController.detalle);
router.get("/cuestionarios/:id/imagen", CuestionariosExplorarController.imagen);
router.post("/cuestionarios/:id/resultado", sesionOpcional, CuestionariosExplorarController.resolver);

export default router;
