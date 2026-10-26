// =====================================================================
// Helpers/SalaHub.ts
// Quién está DENTRO de cada sala de videollamada (en la memoria del
// servidor). Sirve para las sesiones de varias personas: cuando alguien
// entra, se le dice quiénes ya están para que se conecte con cada uno.
//
//   citaId -> usuarioId -> sockets (pestañas) con los que entró
//
// Se guarda por socket para que, si alguien recarga la página, el cierre
// de la pestaña vieja no lo "saque" de la sala si ya entró con la nueva.
// =====================================================================

const salas = new Map<string, Map<string, Set<WebSocket>>>();

export const SalaHub = {
  // Marca que este usuario entró. Devuelve quiénes MÁS están dentro.
  entrar(citaId: string, usuarioId: string, socket: WebSocket): string[] {
    const sala = salas.get(citaId) ?? new Map<string, Set<WebSocket>>();
    const sockets = sala.get(usuarioId) ?? new Set<WebSocket>();
    sockets.add(socket);
    sala.set(usuarioId, sockets);
    salas.set(citaId, sala);
    return [...sala.keys()].filter((id) => id !== usuarioId);
  },

  // Quiénes están dentro (sin contarme a mí)
  presentes(citaId: string, menos = ""): string[] {
    return [...(salas.get(citaId)?.keys() ?? [])].filter((id) => id !== menos);
  },

  // Saca este socket. Devuelve true si el usuario quedó fuera de la sala
  // (no le queda ninguna otra pestaña dentro).
  salir(citaId: string, usuarioId: string, socket: WebSocket): boolean {
    const sala = salas.get(citaId);
    const sockets = sala?.get(usuarioId);
    if (!sala || !sockets) return false;
    sockets.delete(socket);
    if (sockets.size > 0) return false;
    sala.delete(usuarioId);
    if (sala.size === 0) salas.delete(citaId);
    return true;
  },
};
