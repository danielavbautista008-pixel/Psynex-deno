import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PlanesController } from "../../Controller/Administrador/PlanesController.ts";

const router = new Router();

// Público
router.get("/api/planes", PlanesController.listarPublico);

// Admin
router.get("/api/admin/planes", requireAuth, requiereRol("Admin"), PlanesController.listarAdmin);
router.get("/api/admin/planes/:id", requireAuth, requiereRol("Admin"), PlanesController.detalleAdmin);
router.post("/api/admin/planes", requireAuth, requiereRol("Admin"), PlanesController.crear);
router.patch("/api/admin/planes/:id", requireAuth, requiereRol("Admin"), PlanesController.actualizar);
router.delete("/api/admin/planes/:id", requireAuth, requiereRol("Admin"), PlanesController.eliminar);

export default router;