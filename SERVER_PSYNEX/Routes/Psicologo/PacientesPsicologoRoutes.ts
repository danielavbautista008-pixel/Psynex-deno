import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { PacientesPsicologoController } from "../../Controller/Psicologo/PacientesPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

// Pacientes y su historial
router.get("/pacientes", ...soloPsicologo, PacientesPsicologoController.listar);
router.get("/pacientes/:pacienteId", ...soloPsicologo, PacientesPsicologoController.historial);

// Notas de sesión (privadas del psicólogo)
router.get("/pacientes/:pacienteId/notas", ...soloPsicologo, PacientesPsicologoController.listarNotas);
router.post("/pacientes/:pacienteId/notas", ...soloPsicologo, PacientesPsicologoController.crearNota);
router.patch("/notas/:notaId", ...soloPsicologo, PacientesPsicologoController.actualizarNota);
router.delete("/notas/:notaId", ...soloPsicologo, PacientesPsicologoController.eliminarNota);

export default router;
