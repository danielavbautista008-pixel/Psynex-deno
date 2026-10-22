import { z } from "../../Dependencies/dependencias.ts";

export const listarOfertasSchema = z.object({
  busqueda: z.string().trim().max(100).optional(),
  modalidad: z.enum(["todas", "Virtual", "Presencial", "Hibrido"]).optional().default("todas"),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ListarOfertasQuery = z.infer<typeof listarOfertasSchema>;

// Campos de la tabla postulaciones. El formulario de la vista pública solo
// pide teléfono, hoja de vida y un mensaje; lo demás es opcional y se guarda
// vacío (las columnas no aceptan NULL).
export const postularSchema = z.object({
  telefono: z.string().trim().regex(/^\d{7,15}$/, "Teléfono no válido"),
  cartaPresentacion: z.string().trim().max(1000, "El mensaje es demasiado largo").optional().default(""),
  ciudad: z.string().trim().max(100).optional().default(""),
  especialidad: z.string().trim().max(150).optional().default(""),
  experienciaAnos: z.coerce.number().int().min(0).max(60).optional().default(0),
  perfilProfesional: z.string().trim().max(5000).optional().default(""),
});
export type PostularInput = z.infer<typeof postularSchema>;
