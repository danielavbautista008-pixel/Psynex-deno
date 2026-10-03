import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { CitasController } from "../../Controller/Administrador/CitasController.ts";

const router = new Router({ prefix: "/api/admin/citas" });

router.get(
  "/",
  requireAuth,
  requiereRol("Admin"),
  CitasController.listar,
);

router.get(
  "/:id",
  requireAuth,
  requiereRol("Admin"),
  CitasController.detalle,
);

export default router;