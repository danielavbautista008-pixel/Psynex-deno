import { z } from "../../Dependencies/dependencias.ts";

const TipoPlan = z.enum(["Individual", "Empresarial", "Recompensa"]);

export const listarPlanesQuerySchema = z.object({
  publicado: z.enum(["todos", "true", "false"]).optional().default("todos"),
  tipo: z.enum(["todos", "Individual", "Empresarial", "Recompensa"]).optional().default("todos"),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ListarPlanesQuery = z.infer<typeof listarPlanesQuerySchema>;

export const crearPlanSchema = z.object({
  nombre: z.string().trim().min(3).max(150),
  descripcion: z.string().trim().max(1000).optional().default(""),
  beneficios: z.string().trim().max(5000).nullable().optional(),
  tipo: TipoPlan,
  precio: z.coerce.number().min(0),
  moneda: z.string().trim().max(10).optional().default("COP"),
  cantidadSesiones: z.coerce.number().int().min(0).nullable().optional(),
  duracionDias: z.coerce.number().int().min(0).nullable().optional(),
  imagenPortada: z.string().trim().max(500).nullable().optional(),
  publicado: z.boolean().optional().default(false),
  orden: z.coerce.number().int().min(0).optional().default(0),
});
export type CrearPlanInput = z.infer<typeof crearPlanSchema>;

export const actualizarPlanSchema = crearPlanSchema.partial();
export type ActualizarPlanInput = z.infer<typeof actualizarPlanSchema>;