import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { FinanzasPsicologoController } from "../../Controller/Psicologo/FinanzasPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/finanzas" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

router.get("/resumen", ...soloPsicologo, FinanzasPsicologoController.resumen);
router.get("/movimientos", ...soloPsicologo, FinanzasPsicologoController.movimientos);

router.get("/cuentas", ...soloPsicologo, FinanzasPsicologoController.listarCuentas);
router.post("/cuentas", ...soloPsicologo, FinanzasPsicologoController.crearCuenta);
router.patch("/cuentas/:id", ...soloPsicologo, FinanzasPsicologoController.actualizarCuenta);
router.delete("/cuentas/:id", ...soloPsicologo, FinanzasPsicologoController.eliminarCuenta);

router.get("/reclamos", ...soloPsicologo, FinanzasPsicologoController.listarReclamos);
router.post("/reclamos", ...soloPsicologo, FinanzasPsicologoController.crearReclamo);

export default router;
