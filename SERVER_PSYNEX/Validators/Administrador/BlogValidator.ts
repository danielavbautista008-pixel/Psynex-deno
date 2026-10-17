import { z } from "../../Dependencies/dependencias.ts";

export const listarBlogQuerySchema = z.object({
  publicado: z.enum(["todos", "true", "false"]).optional().default("todos"),
  busqueda: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ListarBlogQuery = z.infer<typeof listarBlogQuerySchema>;

export const crearArticuloSchema = z.object({
  titulo: z.string().trim().min(5, "Mínimo 5 caracteres").max(200),
  resumen: z.string().trim().max(500).optional().default(""),
  categoria: z.string().trim().min(2).max(60).optional().default("Salud mental"),
  contenido: z.string().trim().min(20, "El contenido es muy corto"),
  imagenPortada: z.string().trim().max(500).nullable().optional(),
  autorNombre: z.string().trim().min(2).max(150),
  autorRol: z.string().trim().max(80).nullable().optional(),
  publicado: z.boolean().optional().default(false),
});
export type CrearArticuloInput = z.infer<typeof crearArticuloSchema>;

export const actualizarArticuloSchema = z.object({
  titulo: z.string().trim().min(5).max(200).optional(),
  resumen: z.string().trim().max(500).optional(),
  categoria: z.string().trim().min(2).max(60).optional(),
  contenido: z.string().trim().min(20).optional(),
  imagenPortada: z.string().trim().max(500).nullable().optional(),
  autorNombre: z.string().trim().min(2).max(150).optional(),
  autorRol: z.string().trim().max(80).nullable().optional(),
  publicado: z.boolean().optional(),
});
export type ActualizarArticuloInput = z.infer<typeof actualizarArticuloSchema>;