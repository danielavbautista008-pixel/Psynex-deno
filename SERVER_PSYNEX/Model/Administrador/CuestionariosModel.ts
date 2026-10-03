import { conexion } from "../conexion.ts";
import type { CrearCuestionarioInput } from "../../Validators/Administrador/cuestionarioValidator.ts";

export const CuestionarioModel = {
  // RF-24 / RF-42 — listado de cuestionarios, con su categoría clínica
  async listar(filtro: { categoriaId?: string; estadoActivo?: string }) {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtro.categoriaId) {
      condiciones.push("c.CategoriaId = ?");
      valores.push(filtro.categoriaId);
    }
    if (filtro.estadoActivo !== undefined) {
      condiciones.push("c.EstadoActivo = ?");
      valores.push(filtro.estadoActivo === "true" ? 1 : 0);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    return await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario, c.Descripcion, c.NumeroPreguntas,
              c.PuntajeMaximo, c.EstadoActivo, c.CreadoEn,
              cat.CategoriaId, cat.Nombre AS CategoriaNombre
       FROM Cuestionarios c
       LEFT JOIN CategoriasClinicas cat ON cat.CategoriaId = c.CategoriaId
       ${where}
       ORDER BY cat.Nombre, c.NombreCuestionario`,
      valores,
    );
  },

  async obtenerPorId(cuestionarioId: string) {
    const rows = await conexion.query(
      `SELECT c.*, cat.Nombre AS CategoriaNombre
       FROM Cuestionarios c
       LEFT JOIN CategoriasClinicas cat ON cat.CategoriaId = c.CategoriaId
       WHERE c.CuestionarioId = ? LIMIT 1`,
      [cuestionarioId],
    );
    return rows[0];
  },

  // Preguntas + opciones de un cuestionario, para responderlo o revisarlo (RF-22/23/24)
  async obtenerPreguntasConOpciones(cuestionarioId: string) {
    const preguntas = await conexion.query(
      `SELECT PreguntapId, Numero, TextoPregunta
       FROM Preguntas WHERE CuestionarioId = ? ORDER BY Numero`,
      [cuestionarioId],
    );

    if (preguntas.length === 0) return [];

    const ids = preguntas.map((p: { PreguntapId: string }) => p.PreguntapId);
    const placeholders = ids.map(() => "?").join(",");
    const opciones = await conexion.query(
      `SELECT OpcionId, PreguntapId, Texto, Valor
       FROM OpcionesRespuesta WHERE PreguntapId IN (${placeholders})`,
      ids,
    );

    return preguntas.map((p: { PreguntapId: string; Numero: number; TextoPregunta: string }) => ({
      ...p,
      opciones: opciones.filter((o: { PreguntapId: string }) => o.PreguntapId === p.PreguntapId),
    }));
  },

  async listarCategorias() {
    return await conexion.query(`SELECT CategoriaId, Nombre, Descripcion FROM CategoriasClinicas ORDER BY Nombre`);
  },

  // RF-42 — el Administrador agrega un cuestionario nuevo con sus preguntas y opciones
  async crear(data: CrearCuestionarioInput) {
    const cuestionarioId = crypto.randomUUID();

    await conexion.execute(
      `INSERT INTO Cuestionarios (CuestionarioId, CategoriaId, NombreCuestionario, Descripcion, NumeroPreguntas, PuntajeMaximo, EstadoActivo, CreadoEn)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        cuestionarioId,
        data.categoriaId ?? null,
        data.nombreCuestionario,
        data.descripcion,
        data.preguntas.length,
        data.puntajeMaximo,
      ],
    );

    for (const pregunta of data.preguntas) {
      const preguntaId = crypto.randomUUID();
      await conexion.execute(
        `INSERT INTO Preguntas (PreguntapId, CuestionarioId, Numero, TextoPregunta, CreadoEn)
         VALUES (?, ?, ?, ?, NOW())`,
        [preguntaId, cuestionarioId, pregunta.numero, pregunta.textoPregunta],
      );

      for (const opcion of pregunta.opciones) {
        await conexion.execute(
          `INSERT INTO OpcionesRespuesta (OpcionId, PreguntapId, Valor, Texto, CreadoEn)
           VALUES (?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), preguntaId, opcion.valor, opcion.texto],
        );
      }
    }

    return cuestionarioId;
  },

  // RF-42 — activar/desactivar un cuestionario existente
  async cambiarEstado(cuestionarioId: string, estadoActivo: boolean) {
    const resultado = await conexion.execute(
      `UPDATE Cuestionarios SET EstadoActivo = ? WHERE CuestionarioId = ?`,
      [estadoActivo ? 1 : 0, cuestionarioId],
    );
    return resultado.affectedRows ?? 0;
  },

  // RF-42 — estadísticas de uso: cuántas veces se ha respondido cada cuestionario
  async estadisticasUso() {
    return await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario,
              COUNT(r.ResultadoId) AS VecesAplicado
       FROM Cuestionarios c
       LEFT JOIN ResultadoCuestionario r ON r.CuestionarioId = c.CuestionarioId
       GROUP BY c.CuestionarioId, c.NombreCuestionario
       ORDER BY VecesAplicado DESC`,
    );
  },
};