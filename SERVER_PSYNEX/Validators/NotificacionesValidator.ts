import { z } from "../Dependencies/dependencias.ts";

export const listarNotificacionesSchema = z.object({
  soloNoLeidas: z.enum(["true", "false"]).optional().default("false"),
  limite: z.coerce.number().int().min(1).max(100).optional().default(30),
});
export type ListarNotificacionesQuery = z.infer<typeof listarNotificacionesSchema>;
