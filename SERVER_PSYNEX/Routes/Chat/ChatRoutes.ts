import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { ChatController } from "../../Controller/Chat/ChatController.ts";

// Chat entre psicólogo y paciente. Todas las rutas necesitan sesión
// (la cookie "token"); el controlador revisa que el usuario sea parte
// de la conversación que pide.
const router = new Router({ prefix: "/api/chat" });

router.get("/ws", requireAuth, ChatController.socket);               // tiempo real
router.get("/conversaciones", requireAuth, ChatController.conversaciones);
router.get("/conversaciones/:id/mensajes", requireAuth, ChatController.mensajes);
router.post("/conversaciones/:id/mensajes", requireAuth, ChatController.enviar);
router.post("/conversaciones/:id/archivo", requireAuth, ChatController.enviarArchivo);
router.patch("/conversaciones/:id/leidos", requireAuth, ChatController.leidos);
router.patch("/conversaciones/:id/estado", requireAuth, ChatController.estado);
router.get("/mensajes/:id/archivo", requireAuth, ChatController.archivo);
router.get("/usuarios/:id/foto", requireAuth, ChatController.foto);
router.get("/no-leidos", requireAuth, ChatController.noLeidos);

export default router;
