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

// ------------------------------ Estudios ------------------------------
const anioActual = new Date().getFullYear();

export const estudioSchema = z.object({
  universidad: z.string().trim().min(2, "Indica la universidad o institución").max(200),
  titulo: z.string().trim().min(2, "Indica el título").max(200),
  nivelEstudio: z.string().trim().min(2, "Indica el nivel de estudio").max(50),
  // Solo el año de grado (si está en curso no se pide)
  anioGrado: z.coerce.number().int().min(1950, "Año no válido").max(anioActual + 10, "Año no válido")
    .nullable().optional(),
  enCurso: z.boolean().optional().default(false),
});
export type EstudioInput = z.infer<typeof estudioSchema>;

// ----------------------------- Experiencia -----------------------------
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Fecha no válida (AAAA-MM)");

export const experienciaSchema = z.object({
  empresa: z.string().trim().min(2, "Indica el lugar de trabajo").max(200),
  cargo: z.string().trim().min(2, "Indica el cargo").max(150),
  descripcion: z.string().trim().max(500).optional().default(""),
  fechaInicio: mes,
  fechaFin: mes.nullable().optional(),
  trabajaAqui: z.boolean().optional().default(false),
}).superRefine((d, ctx) => {
  if (!d.trabajaAqui && d.fechaFin && d.fechaFin < d.fechaInicio) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fechaFin"], message: "La fecha de fin no puede ser antes del inicio" });
  }
});
export type ExperienciaInput = z.infer<typeof experienciaSchema>;

// ------------------------------- Foto -------------------------------
// La foto llega ya recortada por el navegador como "data:image/...;base64,..."
export const MAX_FOTO_CARACTERES = 1_500_000; // ~1 MB de imagen
export const fotoSchema = z.object({
  foto: z.string()
    .max(MAX_FOTO_CARACTERES, "La foto es demasiado pesada (máximo 1 MB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Formato de foto no válido (JPG, PNG o WEBP)"),
});
export type FotoInput = z.infer<typeof fotoSchema>;
