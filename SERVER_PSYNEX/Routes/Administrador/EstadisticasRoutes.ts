import { Router } from "../../Dependencies/dependencias.ts";
import { EstadisticasController } from "../../Controller/Administrador/EstadisticasController.ts";
import { requireAuth } from "../../Middlewares/RequireAuth.ts";
import { requiereRol } from "../../Middlewares/RequiereRol.ts";

export const EstadisticasRouter = new Router();

// Solo Admin: estadísticas generales de la plataforma.
EstadisticasRouter.get(
    "/estadisticas",
    requireAuth,
    requiereRol("Admin"),
    EstadisticasController.obtener,
);

// También como default, así sirve con cualquiera de los dos estilos de import
export default EstadisticasRouter;