import { z } from "../../Dependencies/dependencias.ts";

// =====================================================================
// Validaciones de las rutas públicas de Explorar.
// Los parámetros de la URL llegan siempre como texto, por eso se usa
// z.coerce cuando se esperan números.
// =====================================================================

const uuid = (mensaje: string) => z.string().uuid(mensaje);

// Ids de preguntas y opciones: algunos cuestionarios cargados en la base
// no tienen ids con formato UUID exacto, así que solo se pide un texto
// corto. Igual se comprueba contra la base de datos al calcular el resultado.
const idTexto = (mensaje: string) => z.string({ message: mensaje }).trim().min(1, mensaje).max(64, mensaje);

// ---------------------------- Psicólogos ----------------------------

export const listarPsicologosSchema = z.object({
  busqueda: z.string().trim().max(100).optional(),
  especialidad: z.string().trim().max(100).optional(),
  modalidad: z.enum(["todas", "Virtual", "Presencial"]).optional().default("todas"),
});
export type ListarPsicologosQuery = z.infer<typeof listarPsicologosSchema>;

export const disponibilidadSchema = z.object({
  // Cuántos días hacia adelante se muestran en el calendario del modal
  dias: z.coerce.number().int().min(1).max(30).optional().default(14),
});

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (AAAA-MM-DD)");
const horaHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)");

export const agendarCitaSchema = z.object({
  fecha: fechaISO,
  hora: horaHHMM,
  modalidad: z.enum(["Virtual", "Presencial"], { message: "Elige una modalidad" }),
  motivo: z.string().trim().max(500, "El motivo es demasiado largo").optional().default(""),
});
export type AgendarCitaInput = z.infer<typeof agendarCitaSchema>;

// ----------------------------- Ofertas -----------------------------

export const listarOfertasPublicasSchema = z.object({
  busqueda: z.string().trim().max(100).optional(),
  modalidad: z.enum(["todas", "Virtual", "Presencial", "Hibrido"]).optional().default("todas"),
});
export type ListarOfertasPublicasQuery = z.infer<typeof listarOfertasPublicasSchema>;

// -------------------------- Cuestionarios --------------------------

export const listarCuestionariosSchema = z.object({
  categoriaId: uuid("Categoría no válida").optional(),
});

export const responderCuestionarioSchema = z.object({
  respuestas: z
    .array(
      z.object({
        preguntaId: idTexto("Pregunta no válida"),
        opcionId: idTexto("Opción no válida"),
      }),
    )
    .min(1, "Responde al menos una pregunta")
    .max(100),
});
export type ResponderCuestionarioInput = z.infer<typeof responderCuestionarioSchema>;
