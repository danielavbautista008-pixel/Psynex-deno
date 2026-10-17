import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { BlogController } from "../../Controller/Administrador/BlogController.ts";

const router = new Router();

// Público (lectura)
router.get("/api/blog", BlogController.listarPublico);
router.get("/api/blog/:slug", BlogController.detallePublico);
router.get("/api/blog/:id/imagen", BlogController.imagen);

// Admin
router.get(
  "/api/admin/blog",
  requireAuth,
  requiereRol("Admin"),
  BlogController.listarAdmin,
);
router.get(
  "/api/admin/blog/:id",
  requireAuth,
  requiereRol("Admin"),
  BlogController.detalleAdmin,
);
router.post(
  "/api/admin/blog",
  requireAuth,
  requiereRol("Admin"),
  BlogController.crear,
);
router.patch(
  "/api/admin/blog/:id",
  requireAuth,
  requiereRol("Admin"),
  BlogController.actualizar,
);
router.delete(
  "/api/admin/blog/:id",
  requireAuth,
  requiereRol("Admin"),
  BlogController.eliminar,
);

// Portada del artículo (multipart, campo "imagen")
router.put(
  "/api/admin/blog/:id/imagen",
  requireAuth,
  requiereRol("Admin"),
  BlogController.subirImagen,
);
router.delete(
  "/api/admin/blog/:id/imagen",
  requireAuth,
  requiereRol("Admin"),
  BlogController.quitarImagen,
);

export default router;