import { conexion } from "../conexion.ts";

export interface PostulacionData {
    PostulacionId: string | null;
    OfertaId: string;
    UsuarioId: string;
    CartaPresent: string | null;
    Estado: "Rechazado" | "Aceptado" | "Pendiente";
    FechadePostulacion: Date | string | null;
    Telefono: string | null;
    Ciudad: string | null;
    Especialidad: string | null;
    ExperienciaAnos: number | null;
    PerfilProfesional: string | null;
}

export interface PostulacionResponseData extends PostulacionData {
  nombreCompleto?: string;
  email?: string;
  tituloOferta?: string;
}

// Obtener postulación por ID
export const obtenerPostulacionPorId = async (id: string | number) => {
  const resultado = await conexion.query(
    `SELECT * FROM postulaciones WHERE PostulacionId = ?`,
    [id]
  );
  return resultado[0];
};

// 1. Obtener postulaciones realizadas por un Usuario
export const obtenerPostulacionesPorUsuario = async (
  usuarioId: string | number
): Promise<PostulacionResponseData[]> => {
  const query = `
    SELECT p.*, o.Titulo as tituloOferta
    FROM postulaciones p
    INNER JOIN ofertaslaborales o ON p.OfertaId = o.OfertaId
    WHERE p.UsuarioId = ?
  `;
  return await conexion.query(query, [usuarioId]);
};

// 2. Obtener postulaciones recibidas por una Empresa (PerfilId)
export const obtenerPostulacionesPorEmpresa = async (
  perfileId: string | number
): Promise<PostulacionResponseData[]> => {
  const query = `
    SELECT p.*, u.NombreCompleto, u.Email, o.Titulo as tituloOferta
    FROM postulaciones p
    INNER JOIN ofertaslaborales o ON p.OfertaId = o.OfertaId
    LEFT JOIN usuarios u ON p.UsuarioId = u.UsuarioId
    WHERE o.PerfileId = ?
  `;
  return await conexion.query(query, [perfileId]);
};

// Validar duplicados de postulación
export const existePostulacionModel = async (
  ofertaId: string | number,
  usuarioId: string | number
): Promise<boolean> => {
  const resultado = await conexion.query(
    `SELECT COUNT(*) as total FROM postulaciones WHERE OfertaId = ? AND UsuarioId = ?`,
    [ofertaId, usuarioId]
  );
  return Number(resultado[0]?.total ?? 0) > 0;
};

// 3. Crear Postulación
export const crearPostulacionModel = async (datos: PostulacionData) => {
  const postulacionId = datos.PostulacionId || crypto.randomUUID();
  const {
    OfertaId,
    UsuarioId,
    CartaPresent,
    Telefono,
    Ciudad,
    Especialidad,
    ExperienciaAnos,
    PerfilProfesional,
    Estado,
  } = datos;

  const resultado = await conexion.execute(
    `INSERT INTO postulaciones 
     (PostulacionId, OfertaId, UsuarioId, CartaPresent, Telefono, Ciudad, Especialidad, ExperienciaAnos, PerfilProfesional, Estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      postulacionId,
      OfertaId,
      UsuarioId,
      CartaPresent || null,
      Telefono || null,
      Ciudad || null,
      Especialidad || null,
      ExperienciaAnos || 0,
      PerfilProfesional || null,
      Estado || "Pendiente",
    ]
  );

  return postulacionId;
};

// 4. Actualizar Postulación
export const actualizarPostulacionModel = async (
  id: string | number,
  datos: Partial<PostulacionData>
) => {
  const {
    CartaPresent,
    Telefono,
    Ciudad,
    Especialidad,
    ExperienciaAnos,
    PerfilProfesional,
    Estado,
  } = datos;

  await conexion.execute(
    `UPDATE postulaciones
     SET CartaPresent = ?, Telefono = ?, Ciudad = ?, Especialidad = ?, ExperienciaAnos = ?, PerfilProfesional = ?, Estado = ?
     WHERE PostulacionId = ?`,
    [
      CartaPresent,
      Telefono,
      Ciudad,
      Especialidad,
      ExperienciaAnos,
      PerfilProfesional,
      Estado,
      id,
    ]
  );
  return true;
};

// 5. Eliminar Postulación
export const eliminarPostulacionModel = async (id: string | number) => {
  await conexion.execute(
    `DELETE FROM postulaciones WHERE PostulacionId = ?`,
    [id]
  );
  return true;
};

// contar postulaciones por empresa y estado
// export const contarPostulacionesPorEmpresaYEstado = async (
//   perfileId: string | number,
//   estado: string
// ): Promise<number> => {
//   const resultado = await conexion.query(
//     `SELECT COUNT(*) as total FROM postulaciones p
//      INNER JOIN ofertaslaborales o ON p.OfertaId = o.OfertaId
//      WHERE o.PerfileId = ? AND p.Estado = ?`,
//     [perfileId, estado]
//   );
//   return Number(resultado[0]?.total ?? 0);
// };
// contar postulaciones por Usuario Psicologo y estado
// export const contarPostulacionesPorUsuarioYEstado = async (
//   usuarioId: string | number,
//   estado: string
// ): Promise<number> => {
//   const resultado = await conexion.query(
//     `SELECT COUNT(*) as total FROM postulaciones
//      WHERE UsuarioId = ? AND Estado = ?`,
//     [usuarioId, estado]
//   );
//   return Number(resultado[0]?.total ?? 0);
// };
