// =====================================================================
// PANEL DE EMPRESA (carpeta empresa.e).
// Validaciones del perfil de la empresa, las ofertas y las postulaciones.
// =====================================================================
import { z } from "../../Dependencies/dependencias.ts";

export const perfilEmpresaSchema = z.object({
  nombreEmpresa: z.string().trim().min(2, "Escribe el nombre de la empresa").max(200),
  nit: z.string().trim().max(20, "El NIT puede tener máximo 20 caracteres").optional().default(""),
  sector: z.string().trim().max(70).optional().default(""),
  descripcion: z.string().trim().max(500, "La descripción puede tener máximo 500 caracteres").optional().default(""),
  sitioWeb: z.string().trim().max(100).optional().default(""),
  telefono: z.string().trim().regex(/^[0-9+\s()-]{0,30}$/, "El teléfono solo puede tener números").optional().default(""),
  direccion: z.string().trim().max(70).optional(),
  // Logo como data URL (JPG, PNG o WEBP). Vacío o ausente = no se cambia.
  logo: z.string()
    .max(7_000_000, "El logo es demasiado pesado (máximo 5 MB)")
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/, "Formato de logo no válido (JPG, PNG o WEBP)")
    .optional()
    .or(z.literal("")),
});
export type PerfilEmpresaInput = z.infer<typeof perfilEmpresaSchema>;

export const ofertaSchema = z.object({
  titulo: z.string().trim().min(3, "Escribe el título de la oferta").max(200),
  descripcion: z.string().trim().min(10, "Describe la oferta (mínimo 10 caracteres)").max(1000),
  requisitos: z.string().trim().min(3, "Escribe los requisitos").max(500),
  salario: z.union([z.coerce.number().min(0).max(100_000_000), z.literal(""), z.null()]).optional(),
  modalidad: z.enum(["Virtual", "Presencial", "Hibrido"], { message: "Elige la modalidad" }),
});
export type OfertaInput = z.infer<typeof ofertaSchema>;

export const estadoOfertaSchema = z.object({
  estado: z.enum(["Activa", "Cerrada"]),
});

export const estadoPostulacionSchema = z.object({
  estado: z.enum(["Pendiente", "Aceptado", "Rechazado"]),
});
