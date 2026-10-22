import { z } from "../../Dependencies/dependencias.ts";

// Mismos nombres de día que ya usa la tabla disponibilidadpsicologo
export const DIAS_SEMANA = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"] as const;

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)");

export const citasDelMesSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido (AAAA-MM)").optional(),
});

export const configuracionAgendaSchema = z
  .object({
    dias: z.array(z.enum(DIAS_SEMANA)).min(1, "Selecciona al menos un día"),
    horaInicio: hora,
    horaFin: hora,
    duracionMinutos: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
    modalidades: z.array(z.enum(["Virtual", "Presencial"])).min(1, "Selecciona al menos una modalidad"),
    tiposConsulta: z.array(z.string().trim().min(2).max(60)).max(10).default([]),
    anticipacionHoras: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48)]),
    cancelacionHoras: z.union([z.literal(6), z.literal(12), z.literal(24), z.literal(48)]),
  })
  .refine((d) => d.horaFin > d.horaInicio, {
    message: "La hora final debe ser mayor que la inicial",
    path: ["horaFin"],
  });
export type ConfiguracionAgendaInput = z.infer<typeof configuracionAgendaSchema>;
