import { z } from "../../Dependencies/dependencias.ts";

export const asignarCuestionarioSchema = z.object({
  cuestionarioId: z.string().uuid("Cuestionario no válido"),
  pacienteId: z.string().uuid("Paciente no válido"),
  fechaLimite: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha límite no válida (AAAA-MM-DD)")
    .nullable()
    .optional(),
  nota: z.string().trim().max(500, "La nota es demasiado larga").optional(),
});
export type AsignarCuestionarioInput = z.infer<typeof asignarCuestionarioSchema>;

export const listarAsignacionesSchema = z.object({
  estado: z.enum(["todos", "Pendiente", "Completado"]).optional().default("todos"),
  pacienteId: z.string().uuid().optional(),
});
export type ListarAsignacionesQuery = z.infer<typeof listarAsignacionesSchema>;
