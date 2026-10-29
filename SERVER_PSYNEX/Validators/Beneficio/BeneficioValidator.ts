// =====================================================================
// Validators/Beneficio/BeneficioValidator.ts
// Beneficio empresarial: una empresa compra un plan para sus trabajadores.
// =====================================================================
import { z } from "../../Dependencies/dependencias.ts";

const uuid = z.string().trim().min(8, "Identificador no válido").max(64, "Identificador no válido");

// POST /api/empresa/beneficio/solicitudes
export const solicitarPlanSchema = z.object({
  planId: uuid,
  empleados: z.coerce
    .number({ invalid_type_error: "Escribe cuántos trabajadores quieres cubrir" })
    .int("El número de trabajadores debe ser entero")
    .min(1, "Debe cubrir al menos 1 trabajador")
    .max(5000, "Máximo 5.000 trabajadores por solicitud"),
});
export type SolicitarPlanInput = z.infer<typeof solicitarPlanSchema>;

// :id en la URL
export const contratoParamsSchema = z.object({ id: uuid });

// GET /api/admin/contratos?estado=
export const listarContratosSchema = z.object({
  estado: z.enum(["todos", "Pendiente", "Activo", "Rechazado", "Finalizado"]).optional().default("todos"),
});

// PATCH /api/admin/contratos/:id/rechazar
export const rechazarContratoSchema = z.object({
  motivo: z.string().trim()
    .min(5, "Escribe el motivo del rechazo (mínimo 5 caracteres)")
    .max(300, "El motivo no puede superar 300 caracteres"),
});

// PUT /api/admin/configuracion/banco
export const bancoSchema = z.object({
  banco: z.string().trim().min(2, "Escribe el nombre del banco").max(60),
  tipoCuenta: z.enum(["Ahorros", "Corriente"], { errorMap: () => ({ message: "Tipo de cuenta no válido" }) }),
  numeroCuenta: z.string().trim().regex(/^[0-9-]{6,25}$/, "Número de cuenta no válido (solo números y guiones)"),
  titular: z.string().trim().min(3, "Escribe el titular de la cuenta").max(120),
  nit: z.string().trim().regex(/^[0-9.-]{6,20}$/, "NIT no válido"),
});
export type BancoInput = z.infer<typeof bancoSchema>;
