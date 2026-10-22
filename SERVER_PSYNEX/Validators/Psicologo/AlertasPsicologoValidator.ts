import { z } from "../../Dependencies/dependencias.ts";

export const listarAlertasSchema = z.object({
  estado: z.enum(["todas", "pendientes", "atendidas"]).optional().default("todas"),
});
export type ListarAlertasQuery = z.infer<typeof listarAlertasSchema>;

// Al atender una alerta se puede dejar registrada la acción tomada
export const atenderAlertaSchema = z.object({
  accion: z.string().trim().min(5, "Describe la acción (mínimo 5 caracteres)").max(500).optional(),
});
export type AtenderAlertaInput = z.infer<typeof atenderAlertaSchema>;
