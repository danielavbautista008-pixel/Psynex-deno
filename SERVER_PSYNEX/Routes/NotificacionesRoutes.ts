import { Router } from "../Dependencies/dependencias.ts";
import { requireAuth } from "../Middlewares/RequireAuth.ts";
import { NotificacionesController } from "../Controller/NotificacionesController.ts";

// Para cualquier usuario con sesión (Paciente, Psicólogo, Empresa o Admin)
const router = new Router({ prefix: "/api/notificaciones" });

router.get("/", requireAuth, NotificacionesController.listar);
router.patch("/leer-todas", requireAuth, NotificacionesController.marcarTodasLeidas);
router.patch("/:id/leida", requireAuth, NotificacionesController.marcarLeida);

export default router;
