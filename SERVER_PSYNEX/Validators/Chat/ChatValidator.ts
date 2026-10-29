import { z } from "../../Dependencies/dependencias.ts";

// Texto de un mensaje (máximo 1000 caracteres, igual que la columna)
export const textoMensajeSchema = z.object({
  texto: z.string().trim().min(1, "El mensaje está vacío").max(1000, "El mensaje es demasiado largo (máx. 1000 caracteres)"),
});
export type TextoMensajeInput = z.infer<typeof textoMensajeSchema>;

// Historial: se piden los mensajes anteriores a una fecha (para "cargar más")
export const listarMensajesSchema = z.object({
  antes: z.string().datetime({ offset: true }).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListarMensajesQuery = z.infer<typeof listarMensajesSchema>;

// El psicólogo cierra o reabre una conversación
export const estadoConversacionSchema = z.object({
  cerrada: z.boolean(),
});

// Lo que el navegador manda por el WebSocket
export const eventoSocketSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("mensaje"), conversacionId: z.string().min(1).max(64), texto: z.string() }),
  z.object({ tipo: z.literal("escribiendo"), conversacionId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("leidos"), conversacionId: z.string().min(1).max(64) }),
  z.object({ tipo: z.literal("ping") }),
  // Sala de videollamada: datos de conexión WebRTC entre los navegadores.
  // "para" es la persona a la que va (oferta, respuesta, ice); sin "para"
  // el aviso va a todos los de la sala (medios).
  z.object({
    tipo: z.literal("sala"),
    citaId: z.string().min(8).max(64),
    accion: z.enum(["hola", "entrar", "oferta", "respuesta", "ice", "medios", "salir"]),
    para: z.string().min(1).max(64).optional(),
    datos: z.unknown().optional(),
  }),
]);
export type EventoSocket = z.infer<typeof eventoSocketSchema>;
