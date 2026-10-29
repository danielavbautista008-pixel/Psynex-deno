// =====================================================================
// cambio: ARCHIVO NUEVO — rutas del panel del paciente
// (Inicio, Registro diario, cancelar y calificar citas)
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PanelPacienteController } from "../../Controller/Paciente/PanelPacienteController.ts";

const router = new Router({ prefix: "/api/paciente" });
const soloPaciente = [requireAuth, requiereRol("Paciente")] as const;

router.get("/inicio", ...soloPaciente, PanelPacienteController.inicio);
router.get("/registro-emocional", ...soloPaciente, PanelPacienteController.registros);
router.put("/registro-emocional", ...soloPaciente, PanelPacienteController.guardarRegistro);
router.patch("/citas/:citaId/cancelar", ...soloPaciente, PanelPacienteController.cancelarCita);
router.post("/citas/:citaId/calificacion", ...soloPaciente, PanelPacienteController.calificarCita);

export default router;
