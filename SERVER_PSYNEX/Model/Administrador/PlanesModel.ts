import { conexion } from "../conexion.ts";
import type {
  ListarPlanesQuery,
  CrearPlanInput,
  ActualizarPlanInput,
} from "../../Validators/Administrador/PlanesValidator.ts";

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 170);
}

export const PlanesModel = {

  async listar(filtros: ListarPlanesQuery, soloPublicados = false) {
    const condiciones: string[] = [];
    const params: (string | number)[] = [];

    if (soloPublicados) {
      condiciones.push("Publicado = 1");
    } else if (filtros.publicado === "true") {
      condiciones.push("Publicado = 1");
    } else if (filtros.publicado === "false") {
      condiciones.push("Publicado = 0");
    }

    if (filtros.tipo && filtros.tipo !== "todos") {
      condiciones.push("Tipo = ?");
      params.push(filtros.tipo);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const offset = (filtros.pagina - 1) * filtros.porPagina;

    const countResult = await conexion.query(
      `SELECT COUNT(*) AS total FROM planes ${where}`,
      params,
    );
    const total = Number(countResult[0]?.total ?? 0);

    const datos = await conexion.query(
      `SELECT * FROM planes
       ${where}
       ORDER BY Orden ASC, CreadoEn DESC
       LIMIT ? OFFSET ?`,
      [...params, filtros.porPagina, offset],
    );

    return { datos, total };
  },

  async buscarPorId(id: string) {
    const rows = await conexion.query(
      `SELECT * FROM planes WHERE PlanId = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async buscarPorSlug(slug: string, soloPublicado = false) {
  const rows = await conexion.query(
    soloPublicado
      ? `SELECT * FROM planes WHERE Slug = ? AND Publicado = 1 LIMIT 1`
      : `SELECT * FROM planes WHERE Slug = ? LIMIT 1`,
    [slug],
  );
  return rows[0] ?? null;
},

  async crear(data: CrearPlanInput, creadoPorId: string) {
    const id = crypto.randomUUID();
    let slug = slugify(data.nombre);
    const existe = await conexion.query(
      `SELECT PlanId FROM planes WHERE Slug = ? LIMIT 1`,
      [slug],
    );
    if (existe[0]) slug = `${slug}-${id.slice(0, 8)}`;

    await conexion.execute(
      `INSERT INTO planes (
        PlanId, Nombre, Slug, Descripcion, Beneficios, Tipo,
        Precio, Moneda, CantidadSesiones, DuracionDias, ImagenPortada,
        Publicado, Orden, CreadoPorId, CreadoEn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        data.nombre,
        slug,
        data.descripcion ?? "",
        data.beneficios ?? null,
        data.tipo,
        data.precio,
        data.moneda ?? "COP",
        data.cantidadSesiones ?? null,
        data.duracionDias ?? null,
        data.imagenPortada ?? null,
        data.publicado ? 1 : 0,
        data.orden ?? 0,
        creadoPorId,
      ],
    );
    return id;
  },

  async actualizar(id: string, data: ActualizarPlanInput) {
    const actual = await this.buscarPorId(id);
    if (!actual) return false;

    const campos: string[] = [];
    const valores: unknown[] = [];

    if (data.nombre !== undefined) {
      campos.push("Nombre = ?");
      valores.push(data.nombre);
      const nuevoSlug = slugify(data.nombre);
      const conflicto = await conexion.query(
        `SELECT PlanId FROM planes WHERE Slug = ? AND PlanId <> ? LIMIT 1`,
        [nuevoSlug, id],
      );
      campos.push("Slug = ?");
      valores.push(conflicto[0] ? `${nuevoSlug}-${id.slice(0, 8)}` : nuevoSlug);
    }
    if (data.descripcion !== undefined) {
      campos.push("Descripcion = ?");
      valores.push(data.descripcion);
    }
    if (data.beneficios !== undefined) {
      campos.push("Beneficios = ?");
      valores.push(data.beneficios);
    }
    if (data.tipo !== undefined) {
      campos.push("Tipo = ?");
      valores.push(data.tipo);
    }
    if (data.precio !== undefined) {
      campos.push("Precio = ?");
      valores.push(data.precio);
    }
    if (data.moneda !== undefined) {
      campos.push("Moneda = ?");
      valores.push(data.moneda);
    }
    if (data.cantidadSesiones !== undefined) {
      campos.push("CantidadSesiones = ?");
      valores.push(data.cantidadSesiones);
    }
    if (data.duracionDias !== undefined) {
      campos.push("DuracionDias = ?");
      valores.push(data.duracionDias);
    }
    if (data.imagenPortada !== undefined) {
      campos.push("ImagenPortada = ?");
      valores.push(data.imagenPortada);
    }
    if (data.publicado !== undefined) {
      campos.push("Publicado = ?");
      valores.push(data.publicado ? 1 : 0);
    }
    if (data.orden !== undefined) {
      campos.push("Orden = ?");
      valores.push(data.orden);
    }

    if (!campos.length) return true;

    campos.push("ActualizadoEn = NOW()");
    valores.push(id);

    await conexion.execute(
      `UPDATE planes SET ${campos.join(", ")} WHERE PlanId = ?`,
      valores,
    );
    return true;
  },

  async eliminar(id: string) {
    const r = await conexion.execute(`DELETE FROM planes WHERE PlanId = ?`, [id]);
    return (r.affectedRows ?? 0) > 0;
  },
};