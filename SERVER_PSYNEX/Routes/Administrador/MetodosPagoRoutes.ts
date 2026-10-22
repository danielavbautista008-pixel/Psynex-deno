import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { MetodosPagoController } from "../../Controller/Administrador/MetodosPagoController.ts";

const router = new Router({ prefix: "/api/admin/metodos-pago" });

router.get("/", requireAuth, requiereRol("Admin"), MetodosPagoController.listar);
router.post("/", requireAuth, requiereRol("Admin"), MetodosPagoController.crear);
router.patch("/:id", requireAuth, requiereRol("Admin"), MetodosPagoController.actualizar);
router.delete("/:id", requireAuth, requiereRol("Admin"), MetodosPagoController.eliminar);

export default router;