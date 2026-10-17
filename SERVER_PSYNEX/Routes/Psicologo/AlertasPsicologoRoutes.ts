import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { AlertasPsicologoController } from "../../Controller/Psicologo/AlertasPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/alertas" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

router.get("/", ...soloPsicologo, AlertasPsicologoController.listar);
router.get("/:id", ...soloPsicologo, AlertasPsicologoController.detalle);
router.patch("/:id/atender", ...soloPsicologo, AlertasPsicologoController.atender);

export default router;
