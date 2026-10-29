import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { SalaController } from "../../Controller/Sala/SalaController.ts";

// Sala de videollamada de Psynex. La señalización (oferta, respuesta,
// candidatos ICE) viaja por el WebSocket del chat: /api/chat/ws
const router = new Router({ prefix: "/api/sala" });

router.get("/:citaId", requireAuth, SalaController.detalle);
router.get("/:citaId/foto/:usuarioId", requireAuth, SalaController.foto);
router.patch("/:citaId/completar", requireAuth, SalaController.completar);

export default router;
