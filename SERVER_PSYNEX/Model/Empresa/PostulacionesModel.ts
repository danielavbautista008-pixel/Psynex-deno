import { conexion } from "../Model/conexion.ts";

export interface PostulacionData {
    postulacionId?: string | null;
    ofertaId: string;
    usuarioId: string;
    cartaPresent?: string | null;
    telefono?: string | null;
    ciudad?: string | null;
    especialidad?: string | null;
    experienciaAnos?: number | null;
    perfilProfesional?: string | null;
}

export interface PostulacionResponseData extends PostulacionData {
    nombreCompleto?: string;
    email?: string;
    tituloOferta?: string;
}

export class Postulacion {
    public _ObjPostulacion: PostulacionData | null;
    public _postulacionId: string | null;

    constructor(ObjPostulacion: PostulacionData | null = null, postulacionId: string | null = null) {
        this._ObjPostulacion = ObjPostulacion;
        this._postulacionId = postulacionId;
    }

    // Seleccionar por ID
    public async SeleccionarPorId(id: string): Promise<PostulacionData | null> {
        const { rows } = await conexion.execute(
            `SELECT * FROM "Postulaciones" WHERE "PostulacionId" = $1`,
            [id]
        );
        return rows.length > 0 ? (rows[0] as PostulacionData) : null;
    }

    // 1. Obtener postulaciones realizadas por un Usuario
    public async SeleccionarPorUsuario(usuarioId: string): Promise<PostulacionResponseData[]> {
        const { rows } = await conexion.execute(
            `SELECT p.*, o."Titulo" as "tituloOferta"
             FROM "Postulaciones" p
             INNER JOIN "OfertasLaborales" o ON p."OfertaId" = o."OfertaId"
             WHERE p."UsuarioId" = $1`,
            [usuarioId]
        );
        return rows as PostulacionResponseData[];
    }

    // 2. Obtener postulaciones recibidas por una Empresa (PerfilId)
    public async SeleccionarPorEmpresa(perfileId: string): Promise<PostulacionResponseData[]> {
        const { rows } = await conexion.execute(
            `SELECT p.*, u."NombreCompleto", u."Email", o."Titulo" as "tituloOferta"
             FROM "Postulaciones" p
             INNER JOIN "OfertasLaborales" o ON p."OfertaId" = o."OfertaId"
             LEFT JOIN "Usuarios" u ON p."UsuarioId" = u."UsuarioId"
             WHERE o."PerfileId" = $1`,
            [perfileId]
        );
        return rows as PostulacionResponseData[];
    }

    // Validar duplicados
    public async ExistePostulacion(ofertaId: string, usuarioId: string): Promise<boolean> {
        const { rows } = await conexion.execute(
            `SELECT COUNT(*) as total FROM "Postulaciones" WHERE "OfertaId" = $1 AND "UsuarioId" = $2`,
            [ofertaId, usuarioId]
        );
        return Number(rows[0]?.total ?? 0) > 0;
    }

    // 3. Crear Postulación
    public async InsertarPostulacion(datos: PostulacionData): Promise<PostulacionResponseData> {
        const id = datos.postulacionId || crypto.randomUUID();

        await conexion.execute(
            `INSERT INTO "Postulaciones" 
             ("PostulacionId", "OfertaId", "UsuarioId", "CartaPresent", "Telefono", "Ciudad", "Especialidad", "ExperienciaAnos", "PerfilProfesional")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                id,
                datos.ofertaId,
                datos.usuarioId,
                datos.cartaPresent ?? null,
                datos.telefono ?? null,
                datos.ciudad ?? null,
                datos.especialidad ?? null,
                datos.experienciaAnos ?? 0,
                datos.perfilProfesional ?? null
            ]
        );

        const { rows: usuarios } = await conexion.execute(
            `SELECT "NombreCompleto", "Email" FROM "Usuarios" WHERE "UsuarioId" = $1`,
            [datos.usuarioId]
        );

        const usuario = usuarios.length > 0 ? usuarios[0] : null;

        return {
            ...datos,
            postulacionId: id,
            nombreCompleto: usuario?.NombreCompleto ?? "Usuario Registrado",
            email: usuario?.Email ?? "Sin Correo",
        };
    }

    // 4. Editar Postulación
    public async ActualizarPostulacion(id: string, datos: Partial<PostulacionData>): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "Postulaciones"
             SET "CartaPresent" = $1,
                 "Telefono" = $2,
                 "Ciudad" = $3,
                 "Especialidad" = $4,
                 "ExperienciaAnos" = $5,
                 "PerfilProfesional" = $6
             WHERE "PostulacionId" = $7`,
            [
                datos.cartaPresent ?? null,
                datos.telefono ?? null,
                datos.ciudad ?? null,
                datos.especialidad ?? null,
                datos.experienciaAnos ?? 0,
                datos.perfilProfesional ?? null,
                id
            ]
        );
        return (result.affectedRows ?? 0) > 0;
    }

    // 5. Eliminar Postulación
    public async EliminarPostulacion(id: string): Promise<boolean> {
        const result = await conexion.execute(
            `DELETE FROM "Postulaciones" WHERE "PostulacionId" = $1`,
            [id]
        );
        return (result.affectedRows ?? 0) > 0;
    }
}