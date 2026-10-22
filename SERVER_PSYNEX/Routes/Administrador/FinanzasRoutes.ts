import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { FinanzasController } from "../../Controller/Administrador/FinanzasController.ts";

const router = new Router({ prefix: "/api/admin/finanzas" });

router.get("/resumen", requireAuth, requiereRol("Admin"), FinanzasController.resumen);
router.get("/pagos", requireAuth, requiereRol("Admin"), FinanzasController.listar);
router.get("/panel", requireAuth, requiereRol("Admin"), FinanzasController.panel);

// Pagos a psicólogos
router.get("/transferencias", requireAuth, requiereRol("Admin"), FinanzasController.transferenciasPendientes);
router.patch("/pagos/:id/transferir", requireAuth, requiereRol("Admin"), FinanzasController.transferirPago);
router.patch("/psicologos/:perfilId/transferir", requireAuth, requiereRol("Admin"), FinanzasController.transferirPsicologo);
router.patch("/cuentas/:id/verificar", requireAuth, requiereRol("Admin"), FinanzasController.verificarCuenta);

export default router;