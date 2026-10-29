// =====================================================================
// cambio: ARCHIVO NUEVO — rutas de solo lectura para que la empresa vea
// las postulaciones a sus ofertas (respuestas y documentos).
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { PostulacionesEmpresaController } from "../../Controller/Empresa/PostulacionesEmpresaController.ts";

const router = new Router();
const soloEmpresa = [requireAuth, requiereRol("Empresa")] as const;

router.get("/api/empresa/postulaciones", ...soloEmpresa, PostulacionesEmpresaController.listar);
router.get("/api/empresa/postulaciones/documentos/:id", ...soloEmpresa, PostulacionesEmpresaController.documento);

export default router;
