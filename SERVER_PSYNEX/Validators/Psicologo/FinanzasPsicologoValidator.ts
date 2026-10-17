import { z } from "../../Dependencies/dependencias.ts";

export const listarMovimientosSchema = z.object({
  transferencia: z.enum(["todos", "Pendiente", "Transferido"]).optional().default("todos"),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ListarMovimientosQuery = z.infer<typeof listarMovimientosSchema>;

export const cuentaSchema = z.object({
  tipoCuenta: z.enum(["Ahorros", "Corriente", "Nequi", "Daviplata"]),
  numeroCuenta: z.string().trim().regex(/^\d{6,20}$/, "Número de cuenta no válido (solo números)"),
  banco: z.string().trim().min(2, "Indica el banco").max(100),
  titularCuenta: z.string().trim().min(3, "Indica el titular").max(150),
  esPrincipal: z.boolean().optional().default(false),
});
export type CuentaInput = z.infer<typeof cuentaSchema>;

export const actualizarCuentaSchema = cuentaSchema.partial();
export type ActualizarCuentaInput = z.infer<typeof actualizarCuentaSchema>;

export const reclamoSchema = z.object({
  motivo: z.string().trim().min(3, "Indica el motivo").max(100),
  descripcion: z.string().trim().min(10, "Describe el reclamo (mínimo 10 caracteres)").max(1000),
  pagoId: z.string().uuid("Pago no válido").nullable().optional(),
});
export type ReclamoInput = z.infer<typeof reclamoSchema>;
