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
  nombreCuestionario: z.string().min(1).max(150), // igual que la columna en la base de datos
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

// Editar los datos generales de un cuestionario (las preguntas no se editan:
// si ya hay respuestas, cambiarlas alteraría los resultados guardados).
export const actualizarCuestionarioSchema = z.object({
  nombreCuestionario: z.string().trim().min(1).max(150).optional(),
  descripcion: z.string().trim().min(1).max(500).optional(),
  categoriaId: z.string().uuid("categoriaId debe ser un UUID válido").nullable().optional(),
  puntajeMaximo: z.number().int().min(1).optional(),
});
export type ActualizarCuestionarioInput = z.infer<typeof actualizarCuestionarioSchema>;

// Corregir el texto de las preguntas y opciones de un cuestionario ya creado.
// Solo se editan las que ya existen (por su id); no se agregan ni se borran.
export const editarPreguntasSchema = z.object({
  preguntas: z.array(
    z.object({
      preguntaId: z.string().trim().min(1, "Pregunta no válida").max(64, "Pregunta no válida"),
      textoPregunta: z.string().trim().min(1, "Hay una pregunta vacía").max(500),
      opciones: z.array(
        z.object({
          opcionId: z.string().trim().min(1, "Opción no válida").max(64, "Opción no válida"),
          texto: z.string().trim().min(1, "Hay una opción vacía").max(200),
          valor: z.number().int("El valor debe ser un número entero").min(0).max(100),
        }),
      ).min(1),
    }),
  ).min(1, "No hay preguntas para guardar").max(100),
});
export type EditarPreguntasInput = z.infer<typeof editarPreguntasSchema>;

