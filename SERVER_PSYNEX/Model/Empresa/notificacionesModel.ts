import { conexion } from "../Model/conexion.ts";

export interface NotificacionData {
    notificacionId?: string | null;
    usuarioId: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    estaLeida?: boolean;
    fechaEnvio?: Date | string | null;
}

export class Notificacion {
    public _ObjNotificacion: NotificacionData | null;
    public _notificacionId: string | null;

    constructor(ObjNotificacion: NotificacionData | null = null, notificacionId: string | null = null) {
        this._ObjNotificacion = ObjNotificacion;
        this._notificacionId = notificacionId;
    }

    // Seleccionar por ID
    public async SeleccionarPorId(id: string): Promise<NotificacionData | null> {
        const { rows } = await conexion.execute(
            `SELECT * FROM "Notificaciones" WHERE "NotificacionId" = $1`,
            [id]
        );
        return rows.length > 0 ? (rows[0] as NotificacionData) : null;
    }

    // Seleccionar notificaciones por UsuarioId ordenadas descendente
    public async SeleccionarPorUsuario(usuarioId: string): Promise<NotificacionData[]> {
        const { rows } = await conexion.execute(
            `SELECT * FROM "Notificaciones" WHERE "UsuarioId" = $1 ORDER BY "FechaEnvio" DESC`,
            [usuarioId]
        );
        return rows as NotificacionData[];
    }

    // Insertar nueva notificación
    public async InsertarNotificacion(datos: NotificacionData): Promise<NotificacionData> {
        const id = datos.notificacionId || crypto.randomUUID();
        const fecha = datos.fechaEnvio || new Date().toISOString();
        const estaLeida = datos.estaLeida ?? false;

        await conexion.execute(
            `INSERT INTO "Notificaciones" 
             ("NotificacionId", "UsuarioId", "Tipo", "Titulo", "Mensaje", "EstaLeida", "FechaEnvio")
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                id,
                datos.usuarioId,
                datos.tipo,
                datos.titulo,
                datos.mensaje,
                estaLeida,
                fecha
            ]
        );

        return {
            ...datos,
            notificacionId: id,
            estaLeida,
            fechaEnvio: fecha
        };
    }

    // Marcar como leída
    public async MarcarComoLeida(id: string): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "Notificaciones" SET "EstaLeida" = true WHERE "NotificacionId" = $1`,
            [id]
        );
        return (result.affectedRows ?? 0) > 0;
    }
}