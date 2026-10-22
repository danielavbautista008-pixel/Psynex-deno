import { Router } from "../../Dependencies/dependencias.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";
import { requierePerfilPsicologo } from "../../Middlewares/RequierePerfilPsicologo.ts";
import { PerfilPsicologoController } from "../../Controller/Psicologo/PerfilPsicologoController.ts";

const router = new Router({ prefix: "/api/psicologo/perfil" });

// Todas las rutas: sesión + rol Psicólogo + que tenga perfil
const soloPsicologo = [requireAuth, requiereRol("Psicologo"), requierePerfilPsicologo] as const;

router.get("/", ...soloPsicologo, PerfilPsicologoController.obtener);
router.patch("/", ...soloPsicologo, PerfilPsicologoController.actualizar);
router.get("/especialidades", ...soloPsicologo, PerfilPsicologoController.catalogoEspecialidades);
router.put("/especialidades", ...soloPsicologo, PerfilPsicologoController.reemplazarEspecialidades);

export default router;
