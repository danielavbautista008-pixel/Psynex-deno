import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { ConfiguracionController } from "../../Controller/Administrador/ConfiguracionController.ts";

const router = new Router({ prefix: "/api/admin" });

const soloAdmin = [requireAuth, requiereRol("Admin")] as const;

// Comisión de Psynex
router.get("/configuracion", ...soloAdmin, ConfiguracionController.listar);
router.patch("/configuracion/comision", ...soloAdmin, ConfiguracionController.actualizarComision);

// Tope mensual de citas gratis
router.get("/recompensas", ...soloAdmin, ConfiguracionController.listarRecompensas);
router.put("/recompensas/:anio/:mes", ...soloAdmin, ConfiguracionController.guardarRecompensa);

// Reclamos de los psicólogos sobre sus pagos
router.get("/reclamos", ...soloAdmin, ConfiguracionController.listarReclamos);
router.patch("/reclamos/:id", ...soloAdmin, ConfiguracionController.responderReclamo);

export default router;
