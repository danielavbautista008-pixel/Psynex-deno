import { conexion } from "../conexion.ts";
export interface FavoritosData {
  FavoritoId: string | number;
  PerfileId: string | number;
  PerfilId: string | number;
  CreadoEn: Date | string | null;
  estado: boolean;
}

// obtener todos los favoritos
export const obtenerTodosFavoritos = async () => {
  const query = `SELECT * FROM empresafavoritos`;
  return await conexion.query(query);
};

// obtener favoritos por ID de perfil 
export const obtenerFavoritosPorPerfilId = async (PerfileId: string | number) => {
  const resultado = await conexion.query(
    "SELECT * FROM empresafavoritos WHERE PerfileId = ?",
    [PerfileId]
  );
  return resultado;
};


//Agregar un favorito
export const agregarFavoritoModel = async (favorito: FavoritosData) => {
  const { PerfileId, PerfilId, estado } = favorito;  
  const resultado = await conexion.execute(
    `INSERT INTO empresafavoritos (PerfileId, PerfilId, estado) VALUES (?, ?, ?)`,
    [PerfileId, PerfilId, estado]
  );
  return resultado;
};



// Actualizar un favorito
export const actualizarEstadoFavoritoModel = async (
  FavoritoId: string | number,
  estado: string
) => {
  await conexion.execute(
    `UPDATE empresafavoritos 
     SET estado = ? 
     WHERE FavoritoId = ?`,
    [estado, FavoritoId]
  );
  return true;
};

// Eliminar un favorito
export const eliminarFavoritoModel = async (FavoritoId: string | number) => {
  const resultado = await conexion.execute(
    "DELETE FROM empresafavoritos WHERE FavoritoId = ?",
    [FavoritoId]
  );
  return resultado;
};

