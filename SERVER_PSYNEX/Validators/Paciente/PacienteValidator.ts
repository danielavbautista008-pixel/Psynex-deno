// =====================================================================
// cambio: ARCHIVO NUEVO — validaciones del panel del paciente:
// registro emocional diario, cancelar una cita y calificar una cita.
// =====================================================================
import { z } from "../../Dependencies/dependencias.ts";

// Opciones que muestra la vista "Registro diario"
export const EMOCIONES = ["Calma", "Alegría", "Gratitud", "Motivación", "Ansiedad", "Tristeza", "Estrés", "Cansancio", "Enojo", "Soledad"] as const;
export const CAUSAS = ["Familia", "Estudio", "Trabajo", "Pareja", "Amigos", "Salud", "Dinero", "Yo mismo/a", "Otro"] as const;
export const ENERGIAS = ["Baja", "Media", "Alta"] as const;

// Registro del día. Desde Inicio se guarda solo la carita (soloEstado = true)
export const registroEmocionalSchema = z.object({
  estado: z.coerce.number().int().min(1, "Elige cómo te sientes").max(5, "Elige cómo te sientes"),
  soloEstado: z.boolean().optional().default(false),
  emociones: z.array(z.enum(EMOCIONES)).max(EMOCIONES.length).optional().default([]),
  causas: z.array(z.enum(CAUSAS)).max(CAUSAS.length).optional().default([]),
  sueno: z.union([z.coerce.number().min(0).max(12), z.literal("")]).optional().nullable(),
  energia: z.union([z.enum(ENERGIAS), z.literal("")]).optional().nullable(),
  nota: z.string().trim().max(500, "La nota puede tener máximo 500 caracteres").optional().default(""),
  compartir: z.boolean().optional().default(true),
});
export type RegistroEmocionalInput = z.infer<typeof registroEmocionalSchema>;

export const cancelarCitaSchema = z.object({
  motivo: z.string().trim().max(300, "El motivo puede tener máximo 300 caracteres").optional().default(""),
});

export const calificarCitaSchema = z.object({
  puntaje: z.coerce.number().int().min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  comentario: z.string().trim().max(500, "El comentario puede tener máximo 500 caracteres").optional().default(""),
});
