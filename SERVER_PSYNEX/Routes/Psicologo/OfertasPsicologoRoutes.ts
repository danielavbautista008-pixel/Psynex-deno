import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { OfertasPsicologoController } from "../../Controller/Psicologo/OfertasPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

router.get("/ofertas", ...soloPsicologo, OfertasPsicologoController.listar);
router.get("/ofertas/:id", ...soloPsicologo, OfertasPsicologoController.detalle);
router.post("/ofertas/:id/postular", ...soloPsicologo, OfertasPsicologoController.postular);
router.get("/postulaciones", ...soloPsicologo, OfertasPsicologoController.misPostulaciones);

export default router;
