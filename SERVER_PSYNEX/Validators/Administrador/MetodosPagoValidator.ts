import { z } from "../../Dependencies/dependencias.ts";

export const crearMetodoPagoSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  estadoActivo: z.boolean().optional().default(true),
});
export type CrearMetodoPagoInput = z.infer<typeof crearMetodoPagoSchema>;

export const actualizarMetodoPagoSchema = z.object({
  nombre: z.string().trim().min(2).max(100).optional(),
  estadoActivo: z.boolean().optional(),
});
export type ActualizarMetodoPagoInput = z.infer<typeof actualizarMetodoPagoSchema>;