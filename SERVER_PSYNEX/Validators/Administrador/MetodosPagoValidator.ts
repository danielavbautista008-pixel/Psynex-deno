import { z } from "../../Dependencies/dependencias.ts";

// Métodos de pago que el administrador ofrece a los pacientes
const nombre = z.string({ message: "Escribe el nombre del método de pago" })
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(100, "El nombre puede tener máximo 100 caracteres");

const descripcion = z.string()
  .trim()
  .max(150, "La descripción puede tener máximo 150 caracteres")
  .nullable()
  .transform((v) => (v ? v : null))
  .optional(); // si no viene, no se toca

export const crearMetodoPagoSchema = z.object({
  nombre,
  descripcion,
  estadoActivo: z.boolean().optional().default(true),
});
export type CrearMetodoPagoInput = z.infer<typeof crearMetodoPagoSchema>;

export const actualizarMetodoPagoSchema = z.object({
  nombre: nombre.optional(),
  descripcion,
  estadoActivo: z.boolean().optional(),
});
export type ActualizarMetodoPagoInput = z.infer<typeof actualizarMetodoPagoSchema>;
