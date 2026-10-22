import { conexion } from "../conexion.ts";

export interface PerfilEmpresaData {
  PerfileId: string | number;
  UsuarioId: string | number;
  NombreEmpresa: string;
  Nit: string;
  Sector?: string | null;
  Telefono?: string | null;
  Direccion?: string | null;
  SitioWeb?: string | null;
  Logo?: string | null;
  Descripcion?: string | null;
  EstaVerificada?: boolean;
  CreadoEn?: Date | string | null;
}

// Obtener todos los perfiles de empresas
export const obtenerTodosPerfilesEmpresa = async () => {
  const query = `SELECT * FROM perfilempresa`;
  return await conexion.query(query);
};

// Obtener perfil por ID de Perfil
export const obtenerPerfilEmpresaPorId = async (id: string | number) => {
  const resultado = await conexion.query(
    "SELECT * FROM perfilempresa WHERE PerfileId = ?",
    [id]
  );
  return resultado[0];
};

// Obtener perfil por ID de Usuario
export const obtenerPerfilEmpresaPorUsuarioId = async (usuarioId: string | number) => {
  const resultado = await conexion.query(
    "SELECT * FROM perfilempresa WHERE UsuarioId = ?",
    [usuarioId]
  );
  return resultado[0];
};

// Crear perfil de empresa
export const crearPerfilEmpresaModel = async (perfil: PerfilEmpresaData) => {
  const {
    UsuarioId,
    NombreEmpresa,
    Nit,
    Sector,
    Telefono,
    Direccion,
    SitioWeb,
    Logo,
    Descripcion,
    EstaVerificada,
  } = perfil;

  const resultado = await conexion.execute(
    `INSERT INTO perfilempresa (UsuarioId, NombreEmpresa, Nit, Sector, Telefono, Direccion, SitioWeb, Logo, Descripcion, EstaVerificada) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      UsuarioId,
      NombreEmpresa,
      Nit,
      Sector || null,
      Telefono || null,
      Direccion || null,
      SitioWeb || null,
      Logo || null,
      Descripcion || null,
      EstaVerificada ?? false,
    ]
  );

  return resultado.lastInsertId;
};

// Actualizar perfil de empresa
export const actualizarPerfilEmpresaModel = async (
  id: string | number,
  perfil: Partial<PerfilEmpresaData>
) => {
  const {
    NombreEmpresa,
    Nit,
    Sector,
    Telefono,
    Direccion,
    SitioWeb,
    Logo,
    Descripcion,
    EstaVerificada,
  } = perfil;

  await conexion.execute(
    `UPDATE perfilempresa 
     SET NombreEmpresa = ?, Nit = ?, Sector = ?, Telefono = ?, Direccion = ?, SitioWeb = ?, Logo = ?, Descripcion = ?, EstaVerificada = ?
     WHERE PerfileId = ?`,
    [
      NombreEmpresa,
      Nit,
      Sector,
      Telefono,
      Direccion,
      SitioWeb,
      Logo,
      Descripcion,
      EstaVerificada,
      id,
    ]
  );
  return true;
};

// Eliminar perfil de empresa
export const eliminarPerfilEmpresaModel = async (id: string | number) => {
  await conexion.execute("DELETE FROM perfilempresa WHERE PerfileId = ?", [id]);
  return true;
};