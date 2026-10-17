import { conexion } from "../conexion.ts";
import type {
  ListarBlogQuery,
  CrearArticuloInput,
  ActualizarArticuloInput,
} from "../../Validators/Administrador/BlogValidator.ts";

export interface ArticuloBlog {
  ArticuloId: string;
  Titulo: string;
  Slug: string;
  Resumen: string;
  Categoria: string;
  Contenido: string;
  ImagenPortada: string | null;
  AutorNombre: string;
  AutorRol: string | null;
  CreadoPorId: string;
  Publicado: number;
  PublicadoEn: string | null;
  CreadoEn: string;
  ActualizadoEn: string | null;
}

function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export const BlogModel = {

  async listar(filtros: ListarBlogQuery, soloPublicados = false) {
    const condiciones: string[] = [];
    const params: (string | number)[] = [];

    if (soloPublicados) {
      condiciones.push("Publicado = 1");
    } else if (filtros.publicado === "true") {
      condiciones.push("Publicado = 1");
    } else if (filtros.publicado === "false") {
      condiciones.push("Publicado = 0");
    }

    if (filtros.busqueda) {
      condiciones.push(
        `(Titulo LIKE ? OR Resumen LIKE ? OR AutorNombre LIKE ?)`,
      );
      const like = `%${filtros.busqueda}%`;
      params.push(like, like, like);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const offset = (filtros.pagina - 1) * filtros.porPagina;

    const countResult = await conexion.query(
      `SELECT COUNT(*) AS total FROM articulosblog ${where}`,
      params,
    );
    const total = Number(countResult[0]?.total ?? 0);

    // En listado no devolvemos Contenido completo (pesado)
    const datos = await conexion.query(
      `SELECT ArticuloId, Titulo, Slug, Resumen, Categoria, ImagenPortada,
              AutorNombre, AutorRol, CreadoPorId, Publicado,
              PublicadoEn, CreadoEn, ActualizadoEn,
              CHAR_LENGTH(Contenido) AS LargoContenido
       FROM articulosblog
       ${where}
       ORDER BY COALESCE(PublicadoEn, CreadoEn) DESC
       LIMIT ? OFFSET ?`,
      [...params, filtros.porPagina, offset],
    );

    return { datos: datos as ArticuloBlog[], total };
  },

  async buscarPorId(id: string): Promise<ArticuloBlog | null> {
    const rows = await conexion.query(
      `SELECT * FROM articulosblog WHERE ArticuloId = ? LIMIT 1`,
      [id],
    );
    return (rows[0] as ArticuloBlog) ?? null;
  },

  async buscarPorSlug(slug: string, soloPublicado = false): Promise<ArticuloBlog | null> {
    const sql = soloPublicado
      ? `SELECT * FROM articulosblog WHERE Slug = ? AND Publicado = 1 LIMIT 1`
      : `SELECT * FROM articulosblog WHERE Slug = ? LIMIT 1`;
    const rows = await conexion.query(sql, [slug]);
    return (rows[0] as ArticuloBlog) ?? null;
  },

  async crear(data: CrearArticuloInput, creadoPorId: string): Promise<string> {
    const id = crypto.randomUUID();
    let slug = slugify(data.titulo);

    // Evitar slug duplicado
    const existe = await conexion.query(
      `SELECT ArticuloId FROM articulosblog WHERE Slug = ? LIMIT 1`,
      [slug],
    );
    if (existe[0]) slug = `${slug}-${id.slice(0, 8)}`;

    const publicado = data.publicado ? 1 : 0;

    await conexion.execute(
      `INSERT INTO articulosblog (
        ArticuloId, Titulo, Slug, Resumen, Categoria, Contenido, ImagenPortada,
        AutorNombre, AutorRol, CreadoPorId, Publicado, PublicadoEn, CreadoEn
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${publicado ? "NOW()" : "NULL"}, NOW())`,
      [
        id,
        data.titulo,
        slug,
        data.resumen ?? "",
        data.categoria ?? "Salud mental",
        data.contenido,
        data.imagenPortada ?? null,
        data.autorNombre,
        data.autorRol ?? null,
        creadoPorId,
        publicado,
      ],
    );

    return id;
  },

  async actualizar(id: string, data: ActualizarArticuloInput): Promise<boolean> {
  const actual = await this.buscarPorId(id);
  if (!actual) return false;

  const campos: string[] = [];
  const valores: unknown[] = [];

  if (data.titulo !== undefined) {
    campos.push("Titulo = ?");
    valores.push(data.titulo);

    const nuevoSlug = slugify(data.titulo);
    const conflicto = await conexion.query(
      `SELECT ArticuloId FROM articulosblog WHERE Slug = ? AND ArticuloId <> ? LIMIT 1`,
      [nuevoSlug, id],
    );
    campos.push("Slug = ?");
    valores.push(conflicto[0] ? `${nuevoSlug}-${id.slice(0, 8)}` : nuevoSlug);
  }

  if (data.resumen !== undefined) {
    campos.push("Resumen = ?");
    valores.push(data.resumen);
  }
  if (data.categoria !== undefined) {
    campos.push("Categoria = ?");
    valores.push(data.categoria);
  }
  if (data.contenido !== undefined) {
    campos.push("Contenido = ?");
    valores.push(data.contenido);
  }
  if (data.imagenPortada !== undefined) {
    campos.push("ImagenPortada = ?");
    valores.push(data.imagenPortada);
  }
  if (data.autorNombre !== undefined) {
    campos.push("AutorNombre = ?");
    valores.push(data.autorNombre);
  }
  if (data.autorRol !== undefined) {
    campos.push("AutorRol = ?");
    valores.push(data.autorRol);
  }
  if (data.publicado !== undefined) {
    campos.push("Publicado = ?");
    valores.push(data.publicado ? 1 : 0);
    if (data.publicado && !actual.Publicado) {
      campos.push("PublicadoEn = NOW()");
    }
    if (!data.publicado) {
      campos.push("PublicadoEn = NULL");
    }
  }

  if (!campos.length) return true;

  campos.push("ActualizadoEn = NOW()");
  valores.push(id);

  await conexion.execute(
    `UPDATE articulosblog SET ${campos.join(", ")} WHERE ArticuloId = ?`,
    valores,
  );
  return true;
},
  async eliminar(id: string): Promise<boolean> {
    const r = await conexion.execute(
      `DELETE FROM articulosblog WHERE ArticuloId = ?`,
      [id],
    );
    return (r.affectedRows ?? 0) > 0;
  },

  // Ruta de la portada (ImagenPortada guarda la ruta dentro de ./uploads)
  async rutaImagen(id: string): Promise<string | null> {
    const rows = await conexion.query(
      `SELECT ImagenPortada FROM articulosblog WHERE ArticuloId = ? LIMIT 1`,
      [id],
    );
    const ruta = rows[0]?.ImagenPortada;
    return ruta ? String(ruta) : null;
  },

  // Cambia (o quita, con null) la portada. Devuelve la ruta anterior
  // para que el controlador borre el archivo viejo.
  async cambiarImagen(id: string, ruta: string | null) {
    const rows = await conexion.query(
      `SELECT ImagenPortada FROM articulosblog WHERE ArticuloId = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) return { existe: false, anterior: null as string | null };
    await conexion.execute(
      `UPDATE articulosblog SET ImagenPortada = ?, ActualizadoEn = NOW() WHERE ArticuloId = ?`,
      [ruta, id],
    );
    const anterior = rows[0].ImagenPortada ? String(rows[0].ImagenPortada) : null;
    return { existe: true, anterior };
  },
};