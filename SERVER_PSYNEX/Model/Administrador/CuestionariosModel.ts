import { conexion } from "../conexion.ts";
import type {
  EditarPreguntasInput,
  CrearCuestionarioInput,
  ActualizarCuestionarioInput,
} from "../../Validators/Administrador/cuestionarioValidator.ts";

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
              c.PuntajeMaximo, c.EstadoActivo, c.CreadoEn, c.ImagenPortada,
              cat.CategoriaId, cat.Nombre AS CategoriaNombre
       FROM cuestionarios c
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       ${where}
       ORDER BY cat.Nombre, c.NombreCuestionario`,
      valores,
    );
  },

  async obtenerPorId(cuestionarioId: string) {
    const rows = await conexion.query(
      `SELECT c.*, cat.Nombre AS CategoriaNombre
       FROM cuestionarios c
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       WHERE c.CuestionarioId = ? LIMIT 1`,
      [cuestionarioId],
    );
    return rows[0];
  },

  // Preguntas + opciones de un cuestionario, para responderlo o revisarlo (RF-22/23/24)
  async obtenerPreguntasConOpciones(cuestionarioId: string) {
    const preguntas = await conexion.query(
      `SELECT PreguntapId, Numero, TextoPregunta
       FROM preguntas WHERE CuestionarioId = ? ORDER BY Numero`,
      [cuestionarioId],
    );

    if (preguntas.length === 0) return [];

    const ids = preguntas.map((p: { PreguntapId: string }) => p.PreguntapId);
    const placeholders = ids.map(() => "?").join(",");
    const opciones = await conexion.query(
      `SELECT OpcionId, PreguntapId, Texto, Valor
       FROM opcionesrespuesta WHERE PreguntapId IN (${placeholders})`,
      ids,
    );

    return preguntas.map((p: { PreguntapId: string; Numero: number; TextoPregunta: string }) => ({
      ...p,
      opciones: opciones.filter((o: { PreguntapId: string }) => o.PreguntapId === p.PreguntapId),
    }));
  },

  async listarCategorias() {
    return await conexion.query(`SELECT CategoriaId, Nombre, Descripcion FROM categoriasclinicas ORDER BY Nombre`);
  },

  // RF-42 — el Administrador agrega un cuestionario nuevo con sus preguntas y opciones
  async crear(data: CrearCuestionarioInput) {
    const cuestionarioId = crypto.randomUUID();

    // Todo en una transacción: si falla una pregunta, no queda nada a medias
    await conexion.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO cuestionarios (CuestionarioId, CategoriaId, NombreCuestionario, Descripcion, NumeroPreguntas, PuntajeMaximo, EstadoActivo, CreadoEn)
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
        await conn.execute(
          `INSERT INTO preguntas (PreguntapId, CuestionarioId, Numero, TextoPregunta, CreadoEn)
           VALUES (?, ?, ?, ?, NOW())`,
          [preguntaId, cuestionarioId, pregunta.numero, pregunta.textoPregunta],
        );

        for (const opcion of pregunta.opciones) {
          await conn.execute(
            `INSERT INTO opcionesrespuesta (OpcionId, PreguntapId, Valor, Texto, CreadoEn)
             VALUES (?, ?, ?, ?, NOW())`,
            [crypto.randomUUID(), preguntaId, opcion.valor, opcion.texto],
          );
        }
      }
    });

    return cuestionarioId;
  },

  // RF-42 — editar los datos generales
  async actualizar(cuestionarioId: string, data: ActualizarCuestionarioInput) {
    const mapa: Record<string, string> = {
      nombreCuestionario: "NombreCuestionario",
      descripcion: "Descripcion",
      categoriaId: "CategoriaId",
      puntajeMaximo: "PuntajeMaximo",
    };
    const campos: string[] = [];
    const valores: unknown[] = [];
    for (const [clave, columna] of Object.entries(mapa)) {
      const valor = data[clave as keyof ActualizarCuestionarioInput];
      if (valor !== undefined) {
        campos.push(`${columna} = ?`);
        valores.push(valor);
      }
    }
    if (!campos.length) return (await this.obtenerPorId(cuestionarioId)) ? 1 : 0;

    const r = await conexion.execute(
      `UPDATE cuestionarios SET ${campos.join(", ")} WHERE CuestionarioId = ?`,
      [...valores, cuestionarioId],
    );
    return r.affectedRows ?? 0;
  },

  // Imagen de portada (la muestra la página pública de Tests).
  // Devuelve la ruta anterior para que el controlador borre el archivo viejo.
  async cambiarImagen(cuestionarioId: string, ruta: string | null): Promise<{ existe: boolean; anterior: string | null }> {
    const [actual] = await conexion.query(
      `SELECT ImagenPortada FROM cuestionarios WHERE CuestionarioId = ? LIMIT 1`,
      [cuestionarioId],
    );
    if (!actual) return { existe: false, anterior: null };
    await conexion.execute(
      `UPDATE cuestionarios SET ImagenPortada = ? WHERE CuestionarioId = ?`,
      [ruta, cuestionarioId],
    );
    return { existe: true, anterior: actual.ImagenPortada ? String(actual.ImagenPortada) : null };
  },

  // Corrige textos de preguntas y opciones. Los PUNTAJES (valor) solo se
  // pueden cambiar si nadie ha respondido el cuestionario, para no alterar
  // resultados que ya se guardaron.
  async actualizarPreguntas(
    cuestionarioId: string,
    data: EditarPreguntasInput,
  ): Promise<"ok" | "no-existe" | "no-pertenece" | "valores-en-uso"> {
    const existe = await this.obtenerPorId(cuestionarioId);
    if (!existe) return "no-existe";

    // Opciones actuales de este cuestionario
    const actuales = await conexion.query(
      `SELECT p.PreguntapId, o.OpcionId, o.Valor
       FROM preguntas p
       LEFT JOIN opcionesrespuesta o ON o.PreguntapId = p.PreguntapId
       WHERE p.CuestionarioId = ?`,
      [cuestionarioId],
    ) as { PreguntapId: string; OpcionId: string | null; Valor: number | null }[];

    const preguntasValidas = new Set(actuales.map((a) => a.PreguntapId));
    const opcionesValidas = new Map(
      actuales.filter((a) => a.OpcionId).map((a) => [String(a.OpcionId), a]),
    );

    let cambiaValores = false;
    for (const p of data.preguntas) {
      if (!preguntasValidas.has(p.preguntaId)) return "no-pertenece";
      for (const o of p.opciones) {
        const actual = opcionesValidas.get(o.opcionId);
        if (!actual || actual.PreguntapId !== p.preguntaId) return "no-pertenece";
        if (Number(actual.Valor) !== o.valor) cambiaValores = true;
      }
    }

    if (cambiaValores) {
      const [uso] = await conexion.query(
        `SELECT
           (SELECT COUNT(*) FROM resultadocuestionario WHERE CuestionarioId = ?) +
           (SELECT COUNT(*) FROM respuestasusuario ru
              JOIN preguntas p ON p.PreguntapId = ru.PreguntaId
             WHERE p.CuestionarioId = ?) AS usos`,
        [cuestionarioId, cuestionarioId],
      );
      if (Number(uso?.usos ?? 0) > 0) return "valores-en-uso";
    }

    await conexion.transaction(async (conn) => {
      for (const p of data.preguntas) {
        await conn.execute(
          `UPDATE preguntas SET TextoPregunta = ? WHERE PreguntapId = ? AND CuestionarioId = ?`,
          [p.textoPregunta, p.preguntaId, cuestionarioId],
        );
        for (const o of p.opciones) {
          await conn.execute(
            `UPDATE opcionesrespuesta SET Texto = ?, Valor = ? WHERE OpcionId = ? AND PreguntapId = ?`,
            [o.texto, o.valor, o.opcionId, p.preguntaId],
          );
        }
      }
    });
    return "ok";
  },

  // RF-42 — eliminar. Solo si nadie lo ha respondido ni está asignado;
  // si ya tiene uso, se debe desactivar para conservar el historial clínico.
  async eliminar(cuestionarioId: string): Promise<"ok" | "no-existe" | "en-uso"> {
    const existe = await this.obtenerPorId(cuestionarioId);
    if (!existe) return "no-existe";

    const [uso] = await conexion.query(
      `SELECT
         (SELECT COUNT(*) FROM resultadocuestionario WHERE CuestionarioId = ?) +
         (SELECT COUNT(*) FROM cuestionarioasignado WHERE CuestionarioId = ?) +
         (SELECT COUNT(*) FROM respuestasusuario ru
            JOIN preguntas p ON p.PreguntapId = ru.PreguntaId
           WHERE p.CuestionarioId = ?) AS usos`,
      [cuestionarioId, cuestionarioId, cuestionarioId],
    );
    if (Number(uso?.usos ?? 0) > 0) return "en-uso";

    await conexion.transaction(async (conn) => {
      await conn.execute(
        `DELETE o FROM opcionesrespuesta o
         JOIN preguntas p ON p.PreguntapId = o.PreguntapId
         WHERE p.CuestionarioId = ?`,
        [cuestionarioId],
      );
      await conn.execute(`DELETE FROM preguntas WHERE CuestionarioId = ?`, [cuestionarioId]);
      await conn.execute(`DELETE FROM mensajesapoyo WHERE CuestionarioId = ?`, [cuestionarioId]);
      await conn.execute(`DELETE FROM cuestionarios WHERE CuestionarioId = ?`, [cuestionarioId]);
    });
    return "ok";
  },

  // RF-42 — activar/desactivar un cuestionario existente
  async cambiarEstado(cuestionarioId: string, estadoActivo: boolean) {
    const resultado = await conexion.execute(
      `UPDATE cuestionarios SET EstadoActivo = ? WHERE CuestionarioId = ?`,
      [estadoActivo ? 1 : 0, cuestionarioId],
    );
    return resultado.affectedRows ?? 0;
  },

  // RF-42 — estadísticas de uso: cuántas veces se ha respondido cada cuestionario
  async estadisticasUso() {
    return await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario,
              COUNT(r.ResultadoId) AS VecesAplicado
       FROM cuestionarios c
       LEFT JOIN resultadocuestionario r ON r.CuestionarioId = c.CuestionarioId
       GROUP BY c.CuestionarioId, c.NombreCuestionario
       ORDER BY VecesAplicado DESC`,
    );
  },
};