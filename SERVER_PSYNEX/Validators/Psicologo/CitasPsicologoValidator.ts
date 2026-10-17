import { z } from "../../Dependencies/dependencias.ts";

// Filtros del listado
export const listarCitasPsicologoSchema = z.object({
  estado: z
    .enum(["todos", "Pendiente", "Confirmada", "Completada", "Cancelada"])
    .optional()
    .default("todos"),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ListarCitasPsicologoQuery = z.infer<typeof listarCitasPsicologoSchema>;

// Al cambiar estado de una cita
export const cambiarEstadoCitaSchema = z.object({
  estado: z.enum(["Confirmada", "Cancelada", "Completada"]),
  motivo: z.string().trim().max(500).optional(),
  linkVideollamada: z.string().trim().max(500).optional(),
});
export type CambiarEstadoCitaInput = z.infer<typeof cambiarEstadoCitaSchema>;