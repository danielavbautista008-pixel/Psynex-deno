// =====================================================================
// cambio: ARCHIVO NUEVO — beneficio de la empresa (lado del paciente)
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { BeneficioPacienteController } from "../../Controller/Paciente/BeneficioPacienteController.ts";

const router = new Router();
const soloPaciente = [requireAuth, requiereRol("Paciente")] as const;

router.get("/api/paciente/beneficio", ...soloPaciente, BeneficioPacienteController.estado);
router.post("/api/paciente/beneficio", ...soloPaciente, BeneficioPacienteController.activar);
router.delete("/api/paciente/beneficio", ...soloPaciente, BeneficioPacienteController.quitar);
router.post("/api/pagos/cita/:citaId/usar-beneficio", ...soloPaciente, BeneficioPacienteController.usarEnCita);

export default router;
