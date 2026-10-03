import { z } from "../../Dependencies/dependencias.ts";

// RF-42 (Gestión de cuestionarios clínicos): agregar uno nuevo con sus preguntas y opciones
export const opcionSchema = z.object({
  texto: z.string().min(1).max(200),
  valor: z.number().int(),
});

export const preguntaSchema = z.object({
  numero: z.number().int().min(1),
  textoPregunta: z.string().min(1).max(500),
  opciones: z.array(opcionSchema).min(2, "Cada pregunta necesita al menos 2 opciones"),
});

export const crearCuestionarioSchema = z.object({
  nombreCuestionario: z.string().min(1).max(20),
  descripcion: z.string().min(1).max(500),
  categoriaId: z.string().uuid("categoriaId debe ser un UUID válido").nullable().optional(),
  puntajeMaximo: z.number().int().min(1),
  preguntas: z.array(preguntaSchema).min(1, "El cuestionario necesita al menos 1 pregunta"),
});
export type CrearCuestionarioInput = z.infer<typeof crearCuestionarioSchema>;

// Activar / desactivar un cuestionario existente
export const cambiarEstadoCuestionarioSchema = z.object({
  estadoActivo: z.boolean(),
});

export const filtroCuestionariosSchema = z.object({
  categoriaId: z.string().uuid().optional(),
  estadoActivo: z.enum(["true", "false"]).optional(),
});
