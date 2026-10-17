// =====================================================================
// Helpers/ChatHub.ts
// "Central" del chat en tiempo real.
//
// Guarda qué usuarios tienen el chat abierto (sus WebSockets) para poder
// empujarles mensajes al instante. Un usuario puede tener varias pestañas
// abiertas, por eso cada usuario tiene un conjunto (Set) de sockets.
//
// Vive en la memoria del servidor: si Deno se reinicia, los navegadores
// se reconectan solos y nada se pierde porque todo queda en la base.
// =====================================================================

const conexiones = new Map<string, Set<WebSocket>>();

export const ChatHub = {
  // Registra un socket nuevo. Devuelve true si es la PRIMERA pestaña del
  // usuario (o sea, acaba de "entrar en línea").
  agregar(usuarioId: string, socket: WebSocket): boolean {
    const sockets = conexiones.get(usuarioId) ?? new Set<WebSocket>();
    const primera = sockets.size === 0;
    sockets.add(socket);
    conexiones.set(usuarioId, sockets);
    return primera;
  },

  // Quita un socket. Devuelve true si era la ÚLTIMA pestaña (sale de línea).
  quitar(usuarioId: string, socket: WebSocket): boolean {
    const sockets = conexiones.get(usuarioId);
    if (!sockets) return false;
    sockets.delete(socket);
    if (sockets.size === 0) {
      conexiones.delete(usuarioId);
      return true;
    }
    return false;
  },

  enLinea(usuarioId: string): boolean {
    return (conexiones.get(usuarioId)?.size ?? 0) > 0;
  },

  // Envía un evento (objeto) a todas las pestañas abiertas de un usuario.
  enviarA(usuarioId: string, evento: Record<string, unknown>) {
    const sockets = conexiones.get(usuarioId);
    if (!sockets) return;
    const texto = JSON.stringify(evento);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(texto);
        } catch {
          /* si una pestaña se cerró justo ahora, se ignora */
        }
      }
    }
  },
};
