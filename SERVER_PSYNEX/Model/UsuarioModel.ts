import { conexion } from "../Model/conexion.ts";
export interface Usuario{ //interface Usuario: Define la estructura y el tipado que debe tener un objeto de tipo usuario dentro del código TypeScript (mapea las columnas de la tabla usuarios de la base de datos).
    UsuarioId: string;
    NombreCompleto: string;
    FechaNacimiento: string;
    Rol:string;
    Email:string;
    PasswordHash:string;
    EstadoActivo:number;
    CreadoEn: string | Date;
}

//quita el hash antes de eviar el usuario al cliente 
export const sinPassword = (U:Usuario) =>{ //Eliminar el hash de la contraseña de un objeto de usuario antes de enviarlo en una respuesta HTTP/JSON al cliente frontend, evitando exponer datos sensibles por seguridad.
    const {PasswordHash: _, ...resto} = U;
    return resto;
};
export const buscarPorEmail = async (email:string): Promise<Usuario | null>=>{
    const res = await conexion.execute("SELECT * FROM usuarios WHERE Email = ? LIMIT 1",
        [email],
   );

   return (res.rows?.[0] as Usuario) || null;

};
export const buscarPorId = async (id:string):Promise<Usuario | null>=> {
    const res = await conexion.execute("SELECT * FROM usuarios WHERE UsuarioId = ? LIMIT 1",
        [id],
    );

    return (res.rows?.[0] as Usuario) ?? null;
};

export const crearUsuario = async (datos:{
    nombreCompleto:string;
    fechaNacimiento:string;
    rol:string;
    email:string;
    passwordHash:string;
}): Promise<string>=>{
    const id = crypto.randomUUID();
    await conexion.execute(`INSERT INTO usuarios (UsuarioId, NombreCompleto, FechaNacimiento, Rol, Email, PasswordHash, EstadoActivo, CreadoEn) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [id, datos.nombreCompleto, datos.fechaNacimiento, datos.rol, datos.email, datos.passwordHash]
    );
    return id;
};