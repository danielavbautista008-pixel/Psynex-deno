import { Router } from "../Dependencies/dependencias.ts";
import {
    getPorUsuario,
    crearNotificacion,
    marcarLeida,
} from "../Controller/notificacionController.ts";

const NotificacionRouter = new Router();

NotificacionRouter.get("/notificaciones/usuario/:usuarioId", getPorUsuario);
NotificacionRouter.post("/notificaciones", crearNotificacion);
NotificacionRouter.put("/notificaciones/:id/leer", marcarLeida);

export { NotificacionRouter };