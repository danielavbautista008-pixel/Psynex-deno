// =====================================================================
// Routes/Beneficio/BeneficioRoutes.ts
// Beneficio empresarial (planes para trabajadores)
// =====================================================================
import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { BeneficioController } from "../../Controller/Beneficio/BeneficioController.ts";

const router = new Router();

const soloEmpresa = [requireAuth, requiereRol("Empresa")] as const;
const soloAdmin = [requireAuth, requiereRol("Admin")] as const;

// Empresa
router.get("/api/empresa/beneficio", ...soloEmpresa, BeneficioController.resumen);
router.get("/api/empresa/beneficio/planes", ...soloEmpresa, BeneficioController.planes);
router.post("/api/empresa/beneficio/solicitudes", ...soloEmpresa, BeneficioController.solicitar);
router.post("/api/empresa/beneficio/solicitudes/:id/comprobante", ...soloEmpresa, BeneficioController.subirComprobante);
router.get("/api/empresa/beneficio/solicitudes/:id/comprobante", ...soloEmpresa, BeneficioController.verComprobanteEmpresa);
router.delete("/api/empresa/beneficio/solicitudes/:id", ...soloEmpresa, BeneficioController.cancelar);

// Administrador
router.get("/api/admin/contratos", ...soloAdmin, BeneficioController.listarAdmin);
router.get("/api/admin/contratos/:id/comprobante", ...soloAdmin, BeneficioController.verComprobanteAdmin);
router.patch("/api/admin/contratos/:id/aprobar", ...soloAdmin, BeneficioController.aprobar);
router.patch("/api/admin/contratos/:id/rechazar", ...soloAdmin, BeneficioController.rechazar);
router.put("/api/admin/configuracion/banco", ...soloAdmin, BeneficioController.guardarBanco);

export default router;
