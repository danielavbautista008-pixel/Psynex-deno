import { z } from "../../Dependencies/dependencias.ts";

export const listarPacientesSchema = z.object({
  busqueda: z.string().trim().max(100).optional(),
  estado: z.enum(["todos", "Activa", "En seguimiento", "Finalizada"]).optional().default("todos"),
});
export type ListarPacientesQuery = z.infer<typeof listarPacientesSchema>;

// Nota de sesión (privada: solo la ve el psicólogo que la escribe)
export const notaSchema = z.object({
  contenido: z.string().trim().min(3, "La nota es muy corta").max(5000, "La nota es demasiado larga"),
  citaId: z.string().uuid("Cita no válida").nullable().optional(),
});
export type NotaInput = z.infer<typeof notaSchema>;

export const actualizarNotaSchema = z.object({
  contenido: z.string().trim().min(3, "La nota es muy corta").max(5000, "La nota es demasiado larga"),
});
