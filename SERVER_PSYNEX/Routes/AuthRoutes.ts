import { Router } from "../Dependencies/dependencias.ts";
import { registrar, login, logout, perfil } from "../Controller/AuthController.ts";
import { requireAuth } from "../Middlewares/AuthMiddleware.ts";

const router = new Router({ prefix: "/api/auth" });

router.post("/register", registrar);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, perfil); // ruta protegida

export default router;
