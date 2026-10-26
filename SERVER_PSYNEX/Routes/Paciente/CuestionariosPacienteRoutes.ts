// =====================================================================
// cambio: ARCHIVO NUEVO — el paciente ve los cuestionarios que le
// asignaron sus psicólogos y su historial de resultados (solo lectura).
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { CuestionariosPacienteController, ResultadosPacienteController } from "../../Controller/Paciente/CuestionariosPacienteController.ts";

const router = new Router();

router.get(
  "/api/paciente/cuestionarios-asignados",
  requireAuth,
  requiereRol("Paciente"),
  CuestionariosPacienteController.asignados,
);

// cambio: historial de resultados del paciente (solo lectura)
router.get("/api/paciente/resultados", requireAuth, requiereRol("Paciente"), ResultadosPacienteController.listar);
router.get("/api/paciente/resultados/:id", requireAuth, requiereRol("Paciente"), ResultadosPacienteController.detalle);

export default router;
