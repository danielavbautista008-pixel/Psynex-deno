import { z } from "../../Dependencies/dependencias.ts";

// Período del selector de la vista: últimos 3, 6 o 12 meses (por defecto 6).
// Llega como texto en la URL (?meses=6) y se convierte a número.
export const filtroEstadisticasSchema = z.object({
  meses: z.enum(["3", "6", "12"], {
    errorMap: () => ({ message: "El período debe ser 3, 6 o 12 meses" }),
  }).default("6").transform(Number),
});
export type FiltroEstadisticasInput = z.infer<typeof filtroEstadisticasSchema>;