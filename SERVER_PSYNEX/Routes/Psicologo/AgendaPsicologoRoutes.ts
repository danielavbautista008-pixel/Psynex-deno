import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { AgendaPsicologoController } from "../../Controller/Psicologo/AgendaPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/agenda" });

const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

// "/configuracion" va antes que cualquier ruta con parámetro
router.get("/configuracion", ...soloPsicologo, AgendaPsicologoController.obtenerConfiguracion);
router.put("/configuracion", ...soloPsicologo, AgendaPsicologoController.guardarConfiguracion);
router.get("/", ...soloPsicologo, AgendaPsicologoController.citasDelMes);

export default router;
