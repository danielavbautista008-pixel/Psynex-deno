import { Router } from "https://deno.land/x/oak/mod.ts";
import {
    getPorUsuario,
    crearNotificacion,
    marcarLeida,
} from "../../Controller/Empresa/notificacionesController.ts";

const NotificacionRouter = new Router();

NotificacionRouter.get("/notificaciones/usuario/:usuarioId", getPorUsuario);
NotificacionRouter.post("/notificaciones", crearNotificacion);
NotificacionRouter.put("/notificaciones/:id/leer", marcarLeida);

export { NotificacionRouter };