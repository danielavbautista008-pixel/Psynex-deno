// =====================================================================
// cambio: ARCHIVO NUEVO — rutas de pagos del paciente (Wompi)
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PagosWompiController } from "../../Controller/Pagos/PagosWompiController.ts";

const router = new Router();
const soloPaciente = [requireAuth, requiereRol("Paciente")] as const;

// Datos del paciente (solo lectura)
router.get("/api/paciente/citas", ...soloPaciente, PagosWompiController.citas);
router.get("/api/paciente/paquetes", ...soloPaciente, PagosWompiController.paquetes);
router.get("/api/paciente/pagos", ...soloPaciente, PagosWompiController.historial);

// Pagar con Wompi
router.post("/api/pagos/wompi/cita/:citaId", ...soloPaciente, PagosWompiController.pagarCita);
router.post("/api/pagos/wompi/plan/:planId", ...soloPaciente, PagosWompiController.comprarPlan);
router.get("/api/pagos/wompi/confirmar/:transaccionId", ...soloPaciente, PagosWompiController.confirmar);

// Pagar la cita con una sesión del paquete
router.post("/api/pagos/cita/:citaId/usar-paquete", ...soloPaciente, PagosWompiController.usarPaquete);

// cambio: administrador — aceptar o rechazar pagos en revisión (modo manual temporal)
const soloAdmin = [requireAuth, requiereRol("Admin")] as const;
router.get("/api/admin/pagos-pacientes", ...soloAdmin, PagosWompiController.pendientesAdmin);
router.patch("/api/admin/pagos-pacientes/:tipo/:id/aprobar", ...soloAdmin, PagosWompiController.aprobarAdmin);
router.patch("/api/admin/pagos-pacientes/:tipo/:id/rechazar", ...soloAdmin, PagosWompiController.rechazarAdmin);

// Webhook de Wompi (sin sesión: se valida con la firma del evento)
router.post("/api/pagos/wompi/eventos", PagosWompiController.eventos);

export default router;
