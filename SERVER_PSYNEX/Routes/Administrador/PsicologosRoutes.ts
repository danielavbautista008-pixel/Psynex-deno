import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PsicologosController } from "../../Controller/Administrador/PsicologosController.ts";

const router = new Router({ prefix: "/api/admin/psicologos" });

router.get("/", requireAuth, requiereRol("Admin"), PsicologosController.listar);
router.get("/resumen", requireAuth, requiereRol("Admin"), PsicologosController.resumen);
// Documentos de verificación (van antes de "/:perfilId")
router.get("/documentos/:documentoId", requireAuth, requiereRol("Admin"), PsicologosController.verDocumento);
router.get("/:perfilId/documentos", requireAuth, requiereRol("Admin"), PsicologosController.listarDocumentos);
router.get("/:perfilId/foto", requireAuth, requiereRol("Admin"), PsicologosController.foto);
router.get("/:perfilId", requireAuth, requiereRol("Admin"), PsicologosController.detalle);
router.patch(
  "/:perfilId/verificacion",
  requireAuth,
  requiereRol("Admin"),
  PsicologosController.decidir,
);

export default router;