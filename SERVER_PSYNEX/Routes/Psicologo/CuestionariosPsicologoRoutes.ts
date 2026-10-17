import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { CuestionariosPsicologoController } from "../../Controller/Psicologo/CuestionariosPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/cuestionarios" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

router.get("/", ...soloPsicologo, CuestionariosPsicologoController.catalogo);
router.get("/asignaciones", ...soloPsicologo, CuestionariosPsicologoController.listarAsignaciones);
router.post("/asignaciones", ...soloPsicologo, CuestionariosPsicologoController.asignar);
router.delete("/asignaciones/:id", ...soloPsicologo, CuestionariosPsicologoController.cancelar);

export default router;
