import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { EmpresasController } from "../../Controller/Administrador/EmpresasController.ts";
import { PsicologosController } from "../../Controller/Administrador/PsicologosController.ts";

const router = new Router({ prefix: "/api/admin/empresas" });

router.get("/", requireAuth, requiereRol("Admin"), EmpresasController.listar);
router.get("/resumen", requireAuth, requiereRol("Admin"), EmpresasController.resumen);
// Documentos de la empresa (RUT, Cámara de Comercio). El archivo se abre con
// el mismo controlador de los psicólogos: valida que esté dentro de ./uploads.
router.get("/documentos/:documentoId", requireAuth, requiereRol("Admin"), PsicologosController.verDocumento);
router.get("/:perfileId/documentos", requireAuth, requiereRol("Admin"), EmpresasController.listarDocumentos);
router.get("/:perfileId/logo", requireAuth, requiereRol("Admin"), EmpresasController.logo);
router.get("/:perfileId", requireAuth, requiereRol("Admin"), EmpresasController.detalle);
router.patch(
  "/:perfileId/verificacion",
  requireAuth,
  requiereRol("Admin"),
  EmpresasController.decidir,
);

export default router;