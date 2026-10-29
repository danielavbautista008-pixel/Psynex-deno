// =====================================================================
// cambio: ARCHIVO NUEVO — validaciones del perfil del paciente
// =====================================================================
import { z } from "../../Dependencies/dependencias.ts";

export const actualizarPerfilPacienteSchema = z.object({
  nombre: z.string().trim().min(3, "Escribe tu nombre completo (mínimo 3 letras)").max(150),
  telefono: z.string().trim().regex(/^[0-9+\s-]{0,15}$/, "El teléfono solo puede tener números").optional().default(""),
  fechaNacimiento: z.string().trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento no válida")
    .refine((f) => {
      const d = new Date(`${f}T00:00:00`);
      const hoy = new Date();
      return !Number.isNaN(d.getTime()) && d < hoy && d.getFullYear() > 1900;
    }, "Fecha de nacimiento no válida")
    .optional()
    .nullable(),
  genero: z.enum(["", "Femenino", "Masculino", "No binario", "Otro"]).optional().default(""),
  ocupacion: z.string().trim().max(100).optional().default(""),
});
export type ActualizarPerfilPacienteInput = z.infer<typeof actualizarPerfilPacienteSchema>;

// Foto como data URL (JPG, PNG o WEBP), máximo ~1 MB
export const fotoPacienteSchema = z.object({
  foto: z.string()
    .max(1_400_000, "La foto es demasiado pesada (máximo 1 MB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Formato de foto no válido (JPG, PNG o WEBP)"),
});

export const ajustesPacienteSchema = z.object({
  recordatorios: z.boolean(),
});
