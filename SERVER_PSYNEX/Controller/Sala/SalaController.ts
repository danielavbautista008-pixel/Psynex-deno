// =====================================================================
// Controller/Sala/SalaController.ts
// Sala de videollamada propia de Psynex (WebRTC).
//
//   GET   /api/sala/:citaId            -> ¿puede entrar? datos de la sesión
//   PATCH /api/sala/:citaId/completar  -> el psicólogo termina la cita
//
// El video NO pasa por Deno: va directo entre los navegadores (cada
// persona se conecta con cada una de las demás; hasta 6 en total).
// Deno solo deja entrar a las personas de la cita (psicólogo, paciente
// y sus acompañantes) y pasa los "datos de conexión" (señalización)
// por el WebSocket del chat.
// =====================================================================
import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import { responderImagen } from "../../Helpers/Imagen.ts";
import { type CitaSala, type MiembroSala, SalaModel } from "../../Model/Sala/SalaModel.ts";
import { responderError } from "../../Helpers/Peticion.ts";
import { decodificarDataUrl } from "../../Model/Explorar/PsicologosExplorarModel.ts";

// La sala abre 10 minutos antes y cierra 30 minutos después de terminar la cita
export const MINUTOS_ANTES = 10;
export const MINUTOS_DESPUES = 30;

const yo = (ctx: Context) => ({
  id: String(ctx.state.usuario?.id ?? ""),
  rol: String(ctx.state.usuario?.rol ?? ""),
});

export type AccesoSala =
  | {
    ok: true;
    cita: CitaSala;
    soyPsicologo: boolean;
    yo: MiembroSala;
    otros: MiembroSala[]; // las demás personas de la cita
    abre: Date;
    cierra: Date;
    puedeEntrar: boolean;
    motivo: string | null;
  }
  | { ok: false; status: number; error: string };

// Revisa si este usuario puede usar la sala de esta cita
export async function accesoSala(citaId: string, usuarioId: string): Promise<AccesoSala> {
  const cita = citaId.length >= 8 && citaId.length <= 64 ? await SalaModel.cita(citaId) : null;
  const miembro = cita?.miembros.find((m) => m.usuarioId === usuarioId);

  // Nadie más puede ver que la cita existe
  if (!cita || !miembro) {
    return { ok: false, status: 404, error: "No encontramos esta sesión." };
  }
  if (cita.modalidad.toLowerCase() !== "virtual") {
    return { ok: false, status: 400, error: "Esta cita es presencial, no tiene sala virtual." };
  }

  const abre = new Date(cita.fechaHora.getTime() - MINUTOS_ANTES * 60_000);
  const cierra = new Date(
    cita.fechaHora.getTime() + (cita.duracionMinutos + MINUTOS_DESPUES) * 60_000,
  );
  const ahora = Date.now();

  let motivo: string | null = null;
  if (cita.estado === "Cancelada") motivo = "cancelada";
  else if (cita.estado === "Pendiente") motivo = "pendiente";
  else if (cita.estado === "Completada") motivo = "completada";
  else if (ahora < abre.getTime()) motivo = "temprano";
  else if (ahora > cierra.getTime()) motivo = "terminada";

  return {
    ok: true,
    cita,
    soyPsicologo: miembro.rol === "Psicologo",
    yo: miembro,
    otros: cita.miembros.filter((m) => m.usuarioId !== usuarioId),
    abre,
    cierra,
    puedeEntrar: motivo === null,
    motivo,
  };
}

export const SalaController = {
  // GET /api/sala/:citaId
  async detalle(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const a = await accesoSala(ctx.params.citaId ?? "", u.id);
      if (!a.ok) return responderError(ctx, a.status, a.error);

      const c = a.cita;
      ctx.response.body = {
        ok: true,
        sala: {
          citaId: c.citaId,
          fechaHora: c.fechaHora.toISOString(),
          duracionMinutos: c.duracionMinutos,
          abre: a.abre.toISOString(),
          cierra: a.cierra.toISOString(),
          puedeEntrar: a.puedeEntrar,
          motivo: a.motivo,
          formato: c.formato,
          yo: { id: u.id, rol: a.yo.rol, nombre: a.yo.nombre },
          // Las demás personas de la cita (para mostrar sus nombres y fotos)
          otros: a.otros.map((m) => ({
            id: m.usuarioId,
            rol: m.rol,
            nombre: m.nombre,
            tieneFoto: m.tieneFoto,
            fotoVersion: m.fotoVersion,
            principal: m.principal,
          })),
          // Solo el psicólogo necesita el id del paciente (para guardar notas)
          pacientePerfilId: a.soyPsicologo ? c.pacientePerfilId : null,
          pacienteNombre: a.soyPsicologo ? c.pacienteNombre : null,
        },
      };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al abrir la sala");
    }
  },

  // GET /api/sala/:citaId/foto/:usuarioId  (foto de alguien de la misma cita)
  async foto(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const a = await accesoSala(ctx.params.citaId ?? "", u.id);
      if (!a.ok) return responderError(ctx, a.status, a.error);
      const otro = a.otros.find((m) => m.usuarioId === ctx.params.usuarioId);
      if (!otro) return responderError(ctx, 404, "Sin foto");
      const img = decodificarDataUrl(await SalaModel.foto(otro.usuarioId));
      if (!img) return responderError(ctx, 404, "Sin foto");
      // cambio: sin caché de 1 hora, así la foto nueva se ve apenas se cambia
      await responderImagen(ctx, img);
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al obtener la foto");
    }
  },

  // PATCH /api/sala/:citaId/completar  (solo el psicólogo de la cita)
  async completar(ctx: RouterContext<string>) {
    const u = yo(ctx);
    try {
      const a = await accesoSala(ctx.params.citaId ?? "", u.id);
      if (!a.ok) return responderError(ctx, a.status, a.error);
      if (!a.soyPsicologo) return responderError(ctx, 403, "Solo el psicólogo puede terminar la cita.");
      const ok = await SalaModel.completar(a.cita.citaId);
      ctx.response.body = { ok: true, completada: ok || a.cita.estado === "Completada" };
    } catch (e) {
      console.error(e);
      responderError(ctx, 500, "Error al terminar la cita");
    }
  },
};
