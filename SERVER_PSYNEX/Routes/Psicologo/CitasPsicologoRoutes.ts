import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { CitasPsicologoController } from "../../Controller/Psicologo/CitasPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/citas" });

// /hoy ANTES de /:id (si no, "hoy" se toma como id)
router.get("/", requireAuth, requiereRol("Psicologo"), CitasPsicologoController.listar);
router.get("/hoy", requireAuth, requiereRol("Psicologo"), CitasPsicologoController.resumenHoy);
router.get("/:id", requireAuth, requiereRol("Psicologo"), CitasPsicologoController.detalle);
router.patch("/:id/estado", requireAuth, requiereRol("Psicologo"), CitasPsicologoController.cambiarEstado);

export default router;