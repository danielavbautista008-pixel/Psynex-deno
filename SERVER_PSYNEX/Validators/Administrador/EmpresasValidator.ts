import { z } from "../../Dependencies/dependencias.ts";

export const listarEmpresasQuerySchema = z.object({
  estado: z
    .enum(["todos", "pendiente", "verificada", "rechazada"])
    .optional()
    .default("pendiente"),
  busqueda: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ListarEmpresasQuery = z.infer<typeof listarEmpresasQuerySchema>;

export const decidirEmpresaSchema = z
  .object({
    aprobado: z.boolean(),
    motivoRechazo: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) => d.aprobado || (d.motivoRechazo !== undefined && d.motivoRechazo.length >= 5),
    {
      message: "Al rechazar, indica un motivo de al menos 5 caracteres",
      path: ["motivoRechazo"],
    },
  );
export type DecidirEmpresaInput = z.infer<typeof decidirEmpresaSchema>;