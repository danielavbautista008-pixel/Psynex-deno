import {conexion} from "../conexion.ts";

export interface PerfilPacienteData {
    PerfilId: string | null;
    UsuarioId: string;
    Foto: string | null;
    Telefono: string | null;
    Genero: string | null;
    Ocupacion: string | null;
    EsAnonimo: boolean | null;
    CreadoEn: Date | string | null;
}

export interface PerfilPacienteResponseData extends PerfilPacienteData {
    nombreCompleto?: string;
    email?: string;
    fechaNacimiento?: Date | string | null;
}

export class PerfilPacienteModel {
    // Obtener todos los perfiles de pacientes (con JOIN a Usuarios donde Rol = 'Paciente')
    public async SeleccionarPerfilesPacientes(): Promise<PerfilPacienteResponseData[]> {
        const result = await conexion.execute(
            `SELECT p.*, u."NombreCompleto", u."Email", u."FechaNacimiento"
             FROM "PerfilPaciente" p
             INNER JOIN "Usuarios" u ON p."UsuarioId" = u."UsuarioId"
             WHERE u."Rol" = 'Paciente'`
        );
        const rows = result.rows ?? [];
        return rows as PerfilPacienteResponseData[];
    }

    // Obtener perfil por ID de Usuario
    public async SeleccionarPorUsuarioId(usuarioId: string): Promise<PerfilPacienteResponseData | null> {
        const result = await conexion.execute(
            `SELECT p.*, u."NombreCompleto", u."Email", u."FechaNacimiento"
             FROM "PerfilPaciente" p
             INNER JOIN "Usuarios" u ON p."UsuarioId" = u."UsuarioId"
             WHERE p."UsuarioId" = $1`,
            [usuarioId]
        );
        const rows = result.rows ?? [];
        return rows.length > 0 ? (rows[0] as PerfilPacienteResponseData) : null;
    }

    // Verificar si un usuario existe
    public async ExisteUsuario(usuarioId: string): Promise<boolean> {
        const result = await conexion.execute(
            `SELECT COUNT(*) as total FROM "Usuarios" WHERE "UsuarioId" = $1`,
            [usuarioId]
        );
        const rows = result.rows ?? [];
        return Number(rows[0]?.total ?? 0) > 0;
    }

    // Verificar si el usuario ya tiene un perfil de paciente
    public async ExistePerfilPaciente(usuarioId: string): Promise<boolean> {
        const result = await conexion.execute(
            `SELECT COUNT(*) as total FROM "PerfilPaciente" WHERE "UsuarioId" = $1`,
            [usuarioId]
        );
        const rows = result.rows ?? [];
        return Number(rows[0]?.total ?? 0) > 0;
    }

    // Obtener datos básicos de un usuario por su ID
    public async ObtenerUsuarioPorId(usuarioId: string): Promise<any> {
        const result = await conexion.execute(
            `SELECT "NombreCompleto", "Email", "FechaNacimiento" FROM "Usuarios" WHERE "UsuarioId" = $1`,
            [usuarioId]
        );
        const rows = result.rows ?? [];
        return rows.length > 0 ? rows[0] : null;
    }

    // Crear Perfil de Paciente
    public async InsertarPerfil(datos: PerfilPacienteData): Promise<PerfilPacienteResponseData> {
        const perfilId = datos.PerfilId || crypto.randomUUID();
        const creadoEn = datos.CreadoEn || new Date().toISOString();
        const esAnonimo = datos.EsAnonimo ?? false;

        await conexion.execute(
            `INSERT INTO "PerfilPaciente" 
             ("PerfiluId", "UsuarioId", "Foto", "Telefono", "Genero", "Ocupacion", "EsAnonimo", "CreadoEn")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                perfilId,
                datos.UsuarioId,
                datos.Foto ?? null,
                datos.Telefono ?? null,
                datos.Genero ?? null,
                datos.Ocupacion ?? null,
                esAnonimo,
                creadoEn
            ]
        );

        const usuario = await this.ObtenerUsuarioPorId(datos.UsuarioId);

        return {
            ...datos,
            PerfilId: perfilId,
            EsAnonimo: esAnonimo,
            CreadoEn: creadoEn,
            nombreCompleto: usuario?.NombreCompleto ?? "Usuario Registrado",
            email: usuario?.Email ?? "Sin Correo",
        };
    }

    // Actualizar Perfil de Paciente (por UsuarioId)
    public async ActualizarPerfil(usuarioId: string, datos: Partial<PerfilPacienteData>): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "PerfilPaciente"
             SET "Foto" = COALESCE($1, "Foto"),
                 "Telefono" = COALESCE($2, "Telefono"),
                 "Genero" = COALESCE($3, "Genero"),
                 "Ocupacion" = COALESCE($4, "Ocupacion"),
                 "EsAnonimo" = COALESCE($5, "EsAnonimo")
             WHERE "UsuarioId" = $6`,
            [
                datos.Foto ?? null,
                datos.Telefono ?? null,
                datos.Genero ?? null,
                datos.Ocupacion ?? null,
                datos.EsAnonimo ?? null,
                usuarioId
            ]
        );
        return (result.affectedRows ?? 0) > 0;
    }

    // Actualizar específicamente la Foto
    public async ActualizarFoto(usuarioId: string, fotoBase64: string): Promise<boolean> {
        const result = await conexion.execute(
            `UPDATE "PerfilPaciente" SET "Foto" = $1 WHERE "UsuarioId" = $2`,
            [fotoBase64, usuarioId]
        );
        return (result.affectedRows ?? 0) > 0;
    }
}