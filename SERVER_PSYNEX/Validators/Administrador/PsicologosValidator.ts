import { z } from "../../Dependencies/dependencias.ts";

export const listarPsicologosQuerySchema = z.object({
  estado: z
    .enum(["todos", "pendiente", "verificado", "rechazado"])
    .optional()
    .default("pendiente"),
  busqueda: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ListarPsicologosQuery = z.infer<typeof listarPsicologosQuerySchema>;

export const decidirVerificacionSchema = z.object({
  aprobado: z.boolean(),
  motivoRechazo: z
    .string()
    .trim()
    .max(500)
    .optional(),
}).refine(
  (d) => d.aprobado || (d.motivoRechazo !== undefined && d.motivoRechazo.length >= 5),
  {
    message: "Al rechazar, indica un motivo de al menos 5 caracteres",
    path: ["motivoRechazo"],
  },
);
export type DecidirVerificacionInput = z.infer<typeof decidirVerificacionSchema>;