// =====================================================================
// cambio: ARCHIVO NUEVO — tareas pendientes del administrador
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PendientesAdminController } from "../../Controller/Administrador/PendientesAdminController.ts";

const router = new Router();

router.get("/api/admin/pendientes", requireAuth, requiereRol("Admin"), PendientesAdminController.resumen);

export default router;
