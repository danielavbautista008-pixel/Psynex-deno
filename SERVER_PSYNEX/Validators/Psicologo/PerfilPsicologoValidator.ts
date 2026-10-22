import { z } from "../../Dependencies/dependencias.ts";

// Datos que el psicólogo puede editar de su propio perfil (todos opcionales).
export const actualizarPerfilSchema = z.object({
  biografia: z.string().trim().max(900, "La biografía es demasiado larga").optional(),
  modalidad: z.enum(["Virtual", "Presencial", "Ambas"]).optional(),
  tipoServicio: z.enum(["Pago", "Voluntario"]).optional(),
  precioPorHora: z.coerce.number().min(0, "El precio no puede ser negativo").max(10_000_000).optional(),
  direccion: z.string().trim().max(300).optional(),
  telefono: z.union([z.literal(""), z.string().trim().regex(/^\d{7,15}$/, "Teléfono no válido")]).optional(),
  servicioVoluntario: z.boolean().optional(),
});
export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;

// Reemplaza la lista de especialidades del psicólogo.
export const especialidadesSchema = z.object({
  especialidadIds: z.array(z.string().uuid("Especialidad no válida")).max(15, "Máximo 15 especialidades"),
});
export type EspecialidadesInput = z.infer<typeof especialidadesSchema>;
