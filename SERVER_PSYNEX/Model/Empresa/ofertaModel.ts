import { conexion } from "../conexion.ts";

export interface OfertaLaboralData {
  OfertaId: string | null;
  PerfileId: string;
  Titulo: string;
  Descripcion: string | null;
  Requisitos: string | null;
  Salario: number | null;
  Modalidad?: string | null;
  Estado: string;
  FechaPublicacion: Date | string | null;
}

// Obtener todas las ofertas laborales activas
export const obtenerTodasOfertas = async () => {
  const query = `SELECT * FROM ofertaslaborales WHERE estado = 'Activa' ORDER BY fechaPublicacion DESC`;
  return await conexion.query(query);
};

// Obtener oferta por ID
export const obtenerOfertaPorId = async (OfertaId: string) => {
  const resultado = await conexion.query(
    "SELECT * FROM ofertaslaborales WHERE OfertaId = ?",
    [OfertaId]
  );
  return resultado[0];
};

// Obtener ofertas por ID de Empresa (Perfil)
export const obtenerOfertasPorEmpresa = async (PerfileId: string) => {
  const query = `SELECT * FROM ofertaslaborales WHERE PerfileId = ? AND Estado = 'Activa' ORDER BY FechaPublicacion DESC`;
  return await conexion.query(query, [PerfileId]);
};

// Contar ofertas activas por empresa
export const contarOfertasActivasPorEmpresa = async (PerfileId: string) => {
  const resultado = await conexion.query(
    "SELECT COUNT(*) AS total FROM ofertaslaborales WHERE PerfileId = ? AND Estado = 'Activa'",
    [PerfileId]
  );
  return Number(resultado[0]?.total ?? 0);
};

// Obtener ofertas públicas destacadas (Límite 3)
export const obtenerOfertasPublicas = async () => {
  const query = `SELECT * FROM ofertaslaborales WHERE Estado = 'Activa' ORDER BY FechaPublicacion DESC LIMIT 3`;
  return await conexion.query(query);
};

// Crear nueva oferta laboral
export const crearOfertaModel = async (oferta: OfertaLaboralData) => {
  const id = oferta.OfertaId || crypto.randomUUID();
  const fecha = oferta.FechaPublicacion || new Date().toISOString();
  const estado = oferta.Estado || "Activa";

  await conexion.execute(
    `INSERT INTO ofertaslaborales 
     (OfertaId, PerfileId, Titulo, Descripcion, Requisitos, Salario, Modalidad, Estado, FechaPublicacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      oferta.PerfileId,
      oferta.Titulo,
      oferta.Descripcion || null,
      oferta.Requisitos || null,
      oferta.Salario || null,
      oferta.Modalidad || null,
      estado,
      fecha,
    ]
  );

  return id;
};

// Actualizar una oferta existente
export const actualizarOfertaModel = async (
  id: string,
  oferta: Partial<OfertaLaboralData>
) => {
  const { Titulo, Descripcion, Requisitos, Salario, Modalidad } = oferta;

  await conexion.execute(
    `UPDATE ofertaslaborales 
     SET Titulo = ?, Descripcion = ?, Requisitos = ?, Salario = ?, Modalidad = ?
     WHERE OfertaId = ?`,
    [
      Titulo,
      Descripcion || null,
      Requisitos || null,
      Salario || null,
      Modalidad || null,
      id,
    ]
  );
  return true;
};

// Eliminar / Desactivar oferta (Cambio de estado a 'Cerrada')
export const desactivarOfertaModel = async (id: string) => {
  await conexion.execute(
    `UPDATE ofertaslaborales SET estado = 'Cerrada' WHERE OfertaId = ?`,
    [id]
  );
  return true;
};

// Eliminar físicamente una oferta
export const eliminarOfertaModel = async (id: string) => {
  await conexion.execute("DELETE FROM ofertaslaborales WHERE OfertaId = ?", [
    id,
  ]);
  return true;
};