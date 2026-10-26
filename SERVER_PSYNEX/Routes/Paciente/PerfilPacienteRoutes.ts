// =====================================================================
// cambio: ARCHIVO NUEVO — rutas de "Mi perfil" del paciente
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PerfilPacienteController } from "../../Controller/Paciente/PerfilPacienteController.ts";

const router = new Router({ prefix: "/api/paciente/perfil" });
const soloPaciente = [requireAuth, requiereRol("Paciente")] as const;

router.get("/", ...soloPaciente, PerfilPacienteController.obtener);
router.patch("/", ...soloPaciente, PerfilPacienteController.actualizar);
router.get("/foto", ...soloPaciente, PerfilPacienteController.foto);
router.put("/foto", ...soloPaciente, PerfilPacienteController.guardarFoto);
router.delete("/foto", ...soloPaciente, PerfilPacienteController.quitarFoto);
router.patch("/ajustes", ...soloPaciente, PerfilPacienteController.ajustes);

export default router;
