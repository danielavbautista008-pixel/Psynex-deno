import { z } from "../../Dependencies/dependencias.ts";

// Query params para listar citas (filtros del admin)
export const listarCitasQuerySchema = z.object({
  busqueda: z.string().optional(),           // paciente o psicólogo
  estado: z
    .enum(["todos", "Completada", "Confirmada", "Pendiente", "Cancelada"])
    .optional()
    .default("todos"),
  modalidad: z
    .enum(["todos", "Presencial", "Virtual"])
    .optional()
    .default("todos"),
  fechaDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
  fechaHasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListarCitasQuery = z.infer<typeof listarCitasQuerySchema>;