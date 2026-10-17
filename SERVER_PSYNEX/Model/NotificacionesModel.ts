import { conexion } from "./conexion.ts";
import type { ListarNotificacionesQuery } from "../Validators/NotificacionesValidator.ts";

// Notificaciones del usuario que inició sesión (cualquier rol)
export const NotificacionesModel = {

  async listar(usuarioId: string, f: ListarNotificacionesQuery) {
    const soloNoLeidas = f.soloNoLeidas === "true" ? "AND EstaLeida = 0" : "";
    const notificaciones = await conexion.query(
      `SELECT NotificacionId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio
       FROM notificaciones
       WHERE UsuarioId = ? ${soloNoLeidas}
       ORDER BY FechaEnvio DESC
       LIMIT ?`,
      [usuarioId, f.limite],
    );
    const [cuenta] = await conexion.query(
      `SELECT COUNT(*) AS n FROM notificaciones WHERE UsuarioId = ? AND EstaLeida = 0`,
      [usuarioId],
    );
    return { notificaciones, noLeidas: Number(cuenta?.n ?? 0) };
  },

  async marcarLeida(usuarioId: string, notificacionId: string) {
    const r = await conexion.execute(
      `UPDATE notificaciones SET EstaLeida = 1 WHERE NotificacionId = ? AND UsuarioId = ?`,
      [notificacionId, usuarioId],
    );
    return (r.affectedRows ?? 0) > 0;
  },

  async marcarTodasLeidas(usuarioId: string) {
    const r = await conexion.execute(
      `UPDATE notificaciones SET EstaLeida = 1 WHERE UsuarioId = ? AND EstaLeida = 0`,
      [usuarioId],
    );
    return r.affectedRows ?? 0;
  },
};
