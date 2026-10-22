import { z } from "../../Dependencies/dependencias.ts";

// RF-165: el admin define el porcentaje de comisión vigente
export const comisionSchema = z.object({
  porcentaje: z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%"),
});

// Tope mensual de citas gratis (programa de recompensas)
export const recompensaPeriodoSchema = z.object({
  cupoCitas: z.coerce.number().int().min(0, "El cupo no puede ser negativo").max(10_000),
  valorPorCita: z.coerce.number().min(0, "El valor no puede ser negativo").max(10_000_000),
});

export const periodoParamsSchema = z.object({
  anio: z.coerce.number().int().min(2024).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
});

// Admin responde un reclamo de un psicólogo
export const responderReclamoSchema = z.object({
  estado: z.enum(["EnRevision", "Resuelto", "Rechazado"]),
  respuesta: z.string().trim().min(5, "Escribe una respuesta (mínimo 5 caracteres)").max(1000).optional(),
}).refine((d) => d.estado === "EnRevision" || d.respuesta, {
  message: "Para resolver o rechazar el reclamo escribe una respuesta",
  path: ["respuesta"],
});

export const listarReclamosSchema = z.object({
  estado: z.enum(["todos", "Abierto", "EnRevision", "Resuelto", "Rechazado"]).optional().default("todos"),
});

// Marcar un pago como transferido al psicólogo (RF-163)
export const transferirPagoSchema = z.object({
  comprobante: z.string().trim().max(200).optional(),
});
