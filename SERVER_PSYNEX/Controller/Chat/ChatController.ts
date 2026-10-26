import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { responderImagen } from "../../Helpers/Imagen.ts";
import {
  estadoConversacionSchema,
  eventoSocketSchema,
  listarMensajesSchema,
  textoMensajeSchema,
} from "../../Validators/Chat/ChatValidator.ts";
import { ChatModel, type MensajeChat } from "../../Model/Chat/ChatModel.ts";
import { ChatHub } from "../../Helpers/ChatHub.ts";
import { SalaHub } from "../../Helpers/SalaHub.ts";
import { erroresZod, leerBody, responderError } from "../../Helpers/Peticion.ts";
import { guardarArchivo, leerArchivoSubido, nombreSeguro } from "../../Helpers/Archivos.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";
import { accesoSala } from "../Sala/SalaController.ts";

const yo = (ctx: Context) => ({
  id: String(ctx.state.usuario?.id ?? ""),
  rol: String(ctx.state.usuario?.rol ?? ""),
});

// Usan el chat: pacientes y psicólogos (por sus citas) y empresas (con sus postulados)
const puedeChatear = (rol: string) => rol === "Paciente" || rol === "Psicologo" || rol === "Empresa";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------
// Archivos permitidos: imágenes JPG/PNG, PDF y Word (.doc/.docx), máx. 5 MB.
// Se revisan los primeros bytes del archivo (no solo la extensión),
// así nadie puede subir otra cosa cambiándole el nombre.
// ---------------------------------------------------------------------
const MAX_BYTES = 5 * 1024 * 1024;
const FIRMAS = [
  { ext: "jpg", mime: "image/jpeg", tipo: "imagen", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", tipo: "imagen", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "pdf", mime: "application/pdf", tipo: "documento", bytes: [0x25, 0x50, 0x44, 0x46] },
  // .docx es un archivo ZIP por dentro (empieza por "PK")
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", tipo: "documento", bytes: [0x50, 0x4b, 0x03, 0x04] },
  // .doc (Word antiguo)
  { ext: "doc", mime: "application/msword", tipo: "documento", bytes: [0xd0, 0xcf, 0x11, 0xe0] },
] as const;

async function validarArchivoChat(archivo: File) {
  if (archivo.size === 0) return { error: "El archivo está vacío" };
  if (archivo.size > MAX_BYTES) return { error: "El archivo supera los 5 MB" };
  const cabecera = new Uint8Array(await archivo.slice(0, 8).arrayBuffer());
  const firma = FIRMAS.find((f) => f.bytes.every((b, i) => cabecera[i] === b));
  if (!firma) return { error: "Solo puedes enviar imágenes (JPG o PNG), PDF o Word" };
  // Un ZIP solo se acepta si de verdad se llama .docx
  if (firma.ext === "docx" && !archivo.name.toLowerCase().endsWith(".docx")) {
    return { error: "Solo puedes enviar imágenes (JPG o PNG), PDF o Word" };
  }
  return { firma };
}

// ---------------------------------------------------------------------
// Envía el mensaje a los dos participantes por el WebSocket. Si el que
// lo recibe no tiene el chat abierto, le deja un aviso en la campana.
// ---------------------------------------------------------------------
async function repartir(mensaje: MensajeChat, emisorId: string, destinoId: string) {
  const evento = { tipo: "mensaje", mensaje };
  ChatHub.enviarA(emisorId, evento); // sus otras pestañas también lo ven
  ChatHub.enviarA(destinoId, evento);
  if (!ChatHub.enLinea(destinoId)) {
    try {
      await ChatModel.notificarMensaje(destinoId, await ChatModel.nombreDe(emisorId));
    } catch (e) {
      console.error("No se pudo crear la notificación del mensaje:", e);
    }
  }
}

// Envía un texto (lo usan la ruta POST y el WebSocket)
async function enviarTexto(usuarioId: string, conversacionId: string, texto: unknown) {
  const v = textoMensajeSchema.safeParse({ texto });
  if (!v.success) return { status: 400, error: erroresZod(v.error) };
  const conv = await ChatModel.participante(conversacionId, usuarioId);
  if (!conv) return { status: 404, error: "Conversación no encontrada" };
  if (conv.cerrada) return { status: 409, error: "Esta conversación está cerrada" };
  const mensaje = await ChatModel.crearMensaje({
    conversacionId, emisorId: usuarioId, tipo: "texto", texto: v.data.texto,
  });
  await repartir(mensaje, usuarioId, conv.otroId);
  return { mensaje };
}

export const ChatController = {

  // GET /api/chat/conversaciones
  async conversaciones(ctx: Context) {
    const u = yo(ctx);
    if (!puedeChatear(u.rol)) return responderError(ctx, 403, "No tienes acceso al chat");
    try {
      await ChatModel.asegurarConversaciones(u.id, u.rol);
      const lista = await ChatModel.listarConversaciones(u.id);
      ctx.response.body = {
        ok: true,
        conversaciones: lista.map((c) => ({ ...c, enLinea: ChatHub.enLinea(c.otroId) })),
      };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar conversaciones");
    }
  },

  // GET /api/chat/conversaciones/:id/mensajes?antes=
  async mensajes(ctx: RouterContext<string>) {
    const u = yo(ctx);
    const v = listarMensajesSchema.safeParse(Object.fromEntries(ctx.request.url.searchParams));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const conv = await ChatModel.participante(ctx.params.id ?? "", u.id);
      if (!conv) return responderError(ctx, 404, "Conversación no encontrada");
      const mensajes = await ChatModel.mensajes(conv.id, v.data);
      ctx.response.body = { ok: true, conversacion: conv, mensajes };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al cargar los mensajes");
    }
  },

  // POST /api/chat/conversaciones/:id/mensajes  { texto }
  // (respaldo por si el WebSocket no está conectado)
  async enviar(ctx: RouterContext<string>) {
    const u = yo(ctx);
    const body = await leerBody(ctx) as { texto?: unknown } | null;
    try {
      const r = await enviarTexto(u.id, ctx.params.id ?? "", body?.texto);
      if ("error" in r) return responderError(ctx, r.status!, r.error!);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, mensaje: r.mensaje };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al enviar el mensaje");
    }
  },

  // POST /api/chat/conversaciones/:id/archivo  (multipart: archivo + texto opcional)
  async enviarArchivo(ctx: RouterContext<string>) {
    const u = yo(ctx);
    if (ctx.request.body.type() !== "form-data") {
      return responderError(ctx, 400, "Envía el archivo como multipart/form-data (campo: archivo)");
    }
    let form: FormData;
    try {
      form = await ctx.request.body.formData();
    } catch {
      return responderError(ctx, 400, "No se pudo leer el formulario");
    }
    const archivo = form.get("archivo");
    if (!(archivo instanceof File)) return responderError(ctx, 400, "Selecciona un archivo");

    try {
      const conv = await ChatModel.participante(ctx.params.id ?? "", u.id);
      if (!conv) return responderError(ctx, 404, "Conversación no encontrada");
      if (conv.cerrada) return responderError(ctx, 409, "Esta conversación está cerrada");

      const r = await validarArchivoChat(archivo);
      if ("error" in r) return responderError(ctx, 400, r.error!);

      // Se guarda en ./uploads/chat/<conversacion>/ con un nombre generado
      const ruta = await guardarArchivo("chat", conv.id, archivo, r.firma.ext);
      const texto = String(form.get("texto") ?? "").trim().slice(0, 1000);
      const mensaje = await ChatModel.crearMensaje({
        conversacionId: conv.id,
        emisorId: u.id,
        tipo: r.firma.tipo,
        texto,
        archivo: { ruta, nombre: nombreSeguro(archivo.name), mime: r.firma.mime, bytes: archivo.size },
      });
      await repartir(mensaje, u.id, conv.otroId);
      ctx.response.status = 201;
      ctx.response.body = { ok: true, mensaje };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al enviar el archivo");
    }
  },

  // GET /api/chat/mensajes/:id/archivo  (devuelve el archivo, no JSON)
  async archivo(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const a = await ChatModel.archivo(ctx.params.id ?? "", u.id);
      const bytes = a ? await leerArchivoSubido(a.ruta) : null;
      if (!a || !bytes) return responderError(ctx, 404, "Archivo no encontrado");
      const verEnNavegador = a.mime.startsWith("image/") || a.mime === "application/pdf";
      ctx.response.headers.set("Content-Type", a.mime || "application/octet-stream");
      ctx.response.headers.set(
        "Content-Disposition",
        `${verEnNavegador ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      );
      ctx.response.headers.set("X-Content-Type-Options", "nosniff");
      ctx.response.headers.set("Cache-Control", "private, max-age=3600");
      ctx.response.body = bytes;
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener el archivo");
    }
  },

  // GET /api/chat/usuarios/:id/foto  (foto de la otra persona)
  async foto(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const img = decodificarDataUrl(await ChatModel.fotoDe(ctx.params.id ?? "", u.id));
      if (!img) return responderError(ctx, 404, "Sin foto");
      // cambio: sin caché de 1 hora, así la foto nueva se ve apenas se cambia
      await responderImagen(ctx, img);
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la foto");
    }
  },

  // PATCH /api/chat/conversaciones/:id/leidos
  async leidos(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const conv = await ChatModel.participante(ctx.params.id ?? "", u.id);
      if (!conv) return responderError(ctx, 404, "Conversación no encontrada");
      const n = await ChatModel.marcarLeidos(conv.id, u.id);
      // La otra persona ve las dos hojitas de "visto"
      if (n > 0) ChatHub.enviarA(conv.otroId, { tipo: "leidos", conversacionId: conv.id });
      ctx.response.body = { ok: true, marcados: n };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al marcar como leídos");
    }
  },

  // PATCH /api/chat/conversaciones/:id/estado  { cerrada }
  // (solo quien inició: el psicólogo con sus pacientes, la empresa con sus postulados)
  async estado(ctx: RouterContext<string>) {
    const u = yo(ctx);
    const v = estadoConversacionSchema.safeParse(await leerBody(ctx));
    if (!v.success) return responderError(ctx, 400, erroresZod(v.error));
    try {
      const conv = await ChatModel.participante(ctx.params.id ?? "", u.id);
      if (!conv) return responderError(ctx, 404, "Conversación no encontrada");
      if (conv.psicologoId !== u.id) return responderError(ctx, 403, "Solo quien inició la conversación puede cerrarla");
      await ChatModel.cambiarEstado(conv.id, v.data.cerrada);
      const evento = { tipo: "conversacion", conversacionId: conv.id, cerrada: v.data.cerrada };
      ChatHub.enviarA(conv.psicologoId, evento);
      ChatHub.enviarA(conv.pacienteId, evento);
      ctx.response.body = { ok: true, cerrada: v.data.cerrada };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al cambiar el estado");
    }
  },

  // GET /api/chat/empresa/postulados  (solo empresa)
  async postulados(ctx: Context) {
    const u = yo(ctx);
    if (u.rol !== "Empresa") return responderError(ctx, 403, "Solo para empresas");
    try {
      const postulados = await ChatModel.postuladosDeEmpresa(u.id);
      ctx.response.body = {
        ok: true,
        postulados: postulados.map((p) => ({ ...p, enLinea: ChatHub.enLinea(p.usuarioId) })),
      };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al listar los postulados");
    }
  },

  // POST /api/chat/empresa/postulados/:usuarioId  -> abre (o crea) el chat con ese postulado
  async escribirPostulado(ctx: RouterContext<string>) {
    const u = yo(ctx);
    if (u.rol !== "Empresa") return responderError(ctx, 403, "Solo para empresas");
    const psicologo = ctx.params.usuarioId ?? "";
    if (!UUID.test(psicologo)) return responderError(ctx, 404, "Postulado no encontrado");
    try {
      const conversacionId = await ChatModel.conversacionConPostulado(u.id, psicologo);
      if (!conversacionId) return responderError(ctx, 404, "Esa persona no se postuló a tus ofertas");
      ctx.response.body = { ok: true, conversacionId };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al abrir la conversación");
    }
  },

  // GET /api/chat/no-leidos  (para la burbuja del botón flotante)
  async noLeidos(ctx: Context) {
    const u = yo(ctx);
    try {
      ctx.response.body = { ok: true, total: await ChatModel.totalNoLeidos(u.id) };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al contar mensajes");
    }
  },

  // GET /api/chat/ws  -> abre el WebSocket (chat en tiempo real)
  socket(ctx: Context) {
    const u = yo(ctx);
    if (!puedeChatear(u.rol)) return responderError(ctx, 403, "No tienes acceso al chat");
    if (!ctx.isUpgradable) return responderError(ctx, 400, "Esta ruta solo acepta WebSocket");

    const socket = ctx.upgrade();

    // Avisa a sus contactos si entró o salió de línea
    const avisarEstado = async (enLinea: boolean) => {
      try {
        for (const otro of await ChatModel.contactos(u.id)) {
          ChatHub.enviarA(otro, { tipo: "estado", usuarioId: u.id, enLinea });
        }
      } catch (e) {
        console.error(e);
      }
    };

    socket.onopen = () => {
      if (ChatHub.agregar(u.id, socket)) avisarEstado(true);
      socket.send(JSON.stringify({ tipo: "listo", usuarioId: u.id }));
    };

    socket.onclose = () => {
      if (ChatHub.quitar(u.id, socket)) avisarEstado(false);
      // Si estaba en una videollamada, se les avisa a los demás
      for (const [citaId, miembros] of salas) {
        if (SalaHub.salir(citaId, u.id, socket)) {
          for (const id of miembros) ChatHub.enviarA(id, { tipo: "sala", citaId, accion: "salio", datos: null, de: u.id });
        }
      }
    };

    socket.onerror = () => {
      /* el cierre se maneja en onclose */
    };

    // Salas de videollamada que este navegador ya tiene permitidas
    // (citaId -> las demás personas de esa cita)
    const salas = new Map<string, Set<string>>();

    socket.onmessage = async (e) => {
      let datos: unknown;
      // Los datos de conexión de video son pequeños; nada más grande de 64 KB
      if (String(e.data).length > 64_000) return;
      try {
        datos = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const v = eventoSocketSchema.safeParse(datos);
      if (!v.success) return;
      const ev = v.data;

      try {
        if (ev.tipo === "ping") {
          socket.send(JSON.stringify({ tipo: "pong" }));
          return;
        }

        if (ev.tipo === "mensaje") {
          const r = await enviarTexto(u.id, ev.conversacionId, ev.texto);
          if ("error" in r) socket.send(JSON.stringify({ tipo: "error", error: r.error }));
          return;
        }

        if (ev.tipo === "sala") {
          // Solo las personas de la cita, y solo cuando la sala está abierta
          let miembros = salas.get(ev.citaId);
          if (!miembros) {
            const a = await accesoSala(ev.citaId, u.id);
            if (!a.ok || !a.puedeEntrar) {
              socket.send(JSON.stringify({ tipo: "sala", citaId: ev.citaId, accion: "error", datos: "No puedes entrar a esta sala." }));
              return;
            }
            miembros = new Set(a.otros.map((m) => m.usuarioId));
            salas.set(ev.citaId, miembros);
          }
          const responder = (accion: string, datos: unknown) =>
            socket.send(JSON.stringify({ tipo: "sala", citaId: ev.citaId, accion, datos }));
          const aTodos = (accion: string, datos: unknown = null) => {
            for (const id of miembros!) ChatHub.enviarA(id, { tipo: "sala", citaId: ev.citaId, accion, datos, de: u.id });
          };

          switch (ev.accion) {
            // Antes de entrar: ¿quiénes ya están dentro?
            case "hola":
              responder("presentes", { ids: SalaHub.presentes(ev.citaId, u.id) });
              return;

            // Entra: se le dice quiénes están (se conecta con cada uno)
            // y a los demás que llegó alguien
            case "entrar":
              responder("presentes", { ids: SalaHub.entrar(ev.citaId, u.id, socket) });
              aTodos("entro");
              return;

            case "salir":
              if (SalaHub.salir(ev.citaId, u.id, socket)) aTodos("salio");
              return;

            // Datos de conexión: van a UNA persona de la misma cita
            case "oferta":
            case "respuesta":
            case "ice":
              if (ev.para && miembros.has(ev.para)) {
                ChatHub.enviarA(ev.para, { tipo: "sala", citaId: ev.citaId, accion: ev.accion, datos: ev.datos ?? null, de: u.id });
              }
              return;

            // Micrófono / cámara / pantalla: a una persona o a todos
            case "medios":
              if (ev.para) {
                if (miembros.has(ev.para)) {
                  ChatHub.enviarA(ev.para, { tipo: "sala", citaId: ev.citaId, accion: "medios", datos: ev.datos ?? null, de: u.id });
                }
              } else aTodos("medios", ev.datos ?? null);
              return;
          }
          return;
        }

        const conv = await ChatModel.participante(ev.conversacionId, u.id);
        if (!conv) return;

        if (ev.tipo === "escribiendo") {
          ChatHub.enviarA(conv.otroId, { tipo: "escribiendo", conversacionId: conv.id });
        }

        if (ev.tipo === "leidos") {
          const n = await ChatModel.marcarLeidos(conv.id, u.id);
          if (n > 0) ChatHub.enviarA(conv.otroId, { tipo: "leidos", conversacionId: conv.id });
        }
      } catch (err) {
        console.error("Error en el chat:", err);
        socket.send(JSON.stringify({ tipo: "error", error: "No se pudo procesar el mensaje" }));
      }
    };
  },
};
