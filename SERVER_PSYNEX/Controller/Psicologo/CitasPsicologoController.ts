import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarCitasPsicologoSchema,
  cambiarEstadoCitaSchema,
} from "../../Validators/Psicologo/CitasPsicologoValidator.ts";
import { conexion } from "../../Model/conexion.ts";
import { CitasPsicologoModel } from "../../Model/Psicologo/CitasPsicologoModel.ts";
import { obtenerPerfilPsicologo } from "../../Helpers/PsicologoAuth.ts";
import { EmailService } from "../../Helpers/EmailService.ts";

// Cambios de estado permitidos para el psicólogo.
// Una cita pendiente se acepta o rechaza; una confirmada se completa o se cancela.
// Las completadas y canceladas ya no cambian.
const TRANSICIONES: Record<string, string[]> = {
  Pendiente: ["Confirmada", "Cancelada"],
  Confirmada: ["Completada", "Cancelada"],
};

function usuarioId(ctx: Context): string {
  return String(ctx.state.usuarioId ?? ctx.state.usuario?.id ?? "");
}

export const CitasPsicologoController = {

  async listar(ctx: Context) {
    const perfil = await obtenerPerfilPsicologo(usuarioId(ctx));
    if (!perfil) {
      ctx.response.status = 403;
      ctx.response.body = { ok: false, error: "No tienes perfil de psicólogo" };
      return;
    }

    const query = Object.fromEntries(ctx.request.url.searchParams.entries());
    const validacion = listarCitasPsicologoSchema.safeParse(query);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const { datos, total } = await CitasPsicologoModel.listar(
        perfil.PerfilId,
        validacion.data,
      );
      ctx.response.body = {
        ok: true,
        total,
        pagina: validacion.data.pagina,
        porPagina: validacion.data.porPagina,
        citas: datos,
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al listar citas" };
    }
  },

  async resumenHoy(ctx: Context) {
    const perfil = await obtenerPerfilPsicologo(usuarioId(ctx));
    if (!perfil) {
      ctx.response.status = 403;
      ctx.response.body = { ok: false, error: "No tienes perfil de psicólogo" };
      return;
    }

    try {
      const resumen = await CitasPsicologoModel.resumenHoy(perfil.PerfilId);
      ctx.response.body = {
        ok: true,
        psicologo: {
          nombre: perfil.NombreCompleto,
          email: perfil.Email,
          verificado: !!perfil.EstaVerificado,
        },
        ...resumen,
      };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener resumen" };
    }
  },

  async detalle(ctx: RouterContext<string>) {
    const perfil = await obtenerPerfilPsicologo(usuarioId(ctx));
    if (!perfil) {
      ctx.response.status = 403;
      ctx.response.body = { ok: false, error: "No tienes perfil de psicólogo" };
      return;
    }

    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta id" };
      return;
    }

    try {
      const cita = await CitasPsicologoModel.buscarPorId(id, perfil.PerfilId);
      if (!cita) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Cita no encontrada" };
        return;
      }
      ctx.response.body = { ok: true, cita };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al obtener cita" };
    }
  },

  async cambiarEstado(ctx: RouterContext<string>) {
    const perfil = await obtenerPerfilPsicologo(usuarioId(ctx));
    if (!perfil) {
      ctx.response.status = 403;
      ctx.response.body = { ok: false, error: "No tienes perfil de psicólogo" };
      return;
    }

    const id = ctx.params.id;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, error: "Falta id" };
      return;
    }

    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      body = null;
    }

    const validacion = cambiarEstadoCitaSchema.safeParse(body);
    if (!validacion.success) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        error: validacion.error.issues.map((i) => i.message),
      };
      return;
    }

    try {
      const cita = await CitasPsicologoModel.buscarPorId(id, perfil.PerfilId);
      if (!cita) {
        ctx.response.status = 404;
        ctx.response.body = { ok: false, error: "Cita no encontrada" };
        return;
      }

      const { estado, motivo, linkVideollamada, direccion, indicaciones } = validacion.data;

      if (!(TRANSICIONES[cita.Estado] ?? []).includes(estado)) {
        ctx.response.status = 409;
        ctx.response.body = {
          ok: false,
          error: `No se puede pasar una cita de "${cita.Estado}" a "${estado}"`,
        };
        return;
      }

      // No se puede marcar como realizada una cita que todavía no ha ocurrido
      if (estado === "Completada" && new Date(cita.FechaHora) > new Date()) {
        ctx.response.status = 409;
        ctx.response.body = { ok: false, error: "La cita todavía no ha ocurrido" };
        return;
      }

      const ok = await CitasPsicologoModel.cambiarEstado(
        id,
        perfil.PerfilId,
        estado,
        { linkVideollamada, direccion, indicaciones },
      );
      if (!ok) {
        ctx.response.status = 400;
        ctx.response.body = { ok: false, error: "No se pudo actualizar la cita" };
        return;
      }

      // cambio: lugar de la cita presencial (ya guardado: el escrito o el del perfil)
      let lugar = "";
      if (estado === "Confirmada" && cita.Modalidad === "Presencial") {
        const [l] = await conexion.query(`SELECT Direccion FROM citas WHERE CitaId = ? LIMIT 1`, [id]) as { Direccion: string | null }[];
        lugar = String(l?.Direccion ?? "").trim();
      }

      const fecha = new Date(cita.FechaHora).toLocaleDateString("es-CO");
      const hora = new Date(cita.FechaHora).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (estado === "Confirmada" && cita.PacienteEmail) {
        EmailService.enviarAceptacionCita({
          to: cita.PacienteEmail,
          nombreUsuario: cita.PacienteNombre,
          nombrePsicologo: perfil.NombreCompleto,
          fecha,
          hora,
          modalidad: cita.Modalidad,
          enlaceVideollamada: linkVideollamada ?? cita.LinkVideollamada,
          direccion: lugar, // cambio: lugar + botón de Google Maps en el correo
          indicaciones,
        }).catch((err) => console.error("Email confirmación:", err));
      }

      if (estado === "Cancelada" && cita.PacienteEmail) {
        EmailService.enviarCancelacionCita({
          to: cita.PacienteEmail,
          nombreUsuario: cita.PacienteNombre,
          fecha,
          hora,
          motivo,
        }).catch((err) => console.error("Email cancelación:", err));
      }

      // cambio: la notificación dentro de Psynex también le llega al paciente
      // que agendó (antes solo recibía el correo; la notificación solo les
      // llegaba a los acompañantes).
      if (estado === "Confirmada" || estado === "Cancelada") {
        try {
          const [titular] = await conexion.query(
            `SELECT pa.UsuarioId FROM perfilpaciente pa WHERE pa.PerfiluId = ? LIMIT 1`,
            [cita.PacienteId],
          ) as { UsuarioId: string }[];
          if (titular?.UsuarioId) {
            await conexion.execute(
              `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
               VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
              [
                crypto.randomUUID(),
                titular.UsuarioId,
                estado === "Confirmada" ? "Cita confirmada" : "Cita cancelada",
                estado === "Confirmada"
                  ? `${perfil.NombreCompleto} aceptó tu cita del ${fecha} a las ${hora}.${lugar ? ` Lugar: ${lugar}.` : ""} Ya puedes pagarla en Mis citas.`
                  : `${perfil.NombreCompleto} canceló tu cita del ${fecha} a las ${hora}.${motivo ? ` Motivo: ${motivo}` : ""}`,
              ],
            );
          }
        } catch (err) {
          console.error("Notificación paciente:", err);
        }
      }

      // Cita de pareja o familiar: los acompañantes también se enteran
      if (estado === "Confirmada" || estado === "Cancelada") {
        const acompanantes = await CitasPsicologoModel.acompanantes(id).catch(() => []);
        for (const a of acompanantes) {
          if (estado === "Confirmada") {
            EmailService.enviarAceptacionCita({
              to: a.Email,
              nombreUsuario: a.NombreCompleto,
              nombrePsicologo: perfil.NombreCompleto,
              fecha,
              hora,
              modalidad: cita.Modalidad,
              enlaceVideollamada: linkVideollamada ?? cita.LinkVideollamada,
              direccion: lugar,
              indicaciones,
            }).catch((err) => console.error("Email confirmación (acompañante):", err));
          } else {
            EmailService.enviarCancelacionCita({
              to: a.Email,
              nombreUsuario: a.NombreCompleto,
              fecha,
              hora,
              motivo,
            }).catch((err) => console.error("Email cancelación (acompañante):", err));
          }
          await conexion.execute(
            `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
             VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
            [
              crypto.randomUUID(),
              a.UsuarioId,
              estado === "Confirmada" ? "Cita confirmada" : "Cita cancelada",
              estado === "Confirmada"
                ? `${perfil.NombreCompleto} confirmó la cita del ${fecha} a las ${hora}.`
                : `La cita del ${fecha} a las ${hora} fue cancelada.`,
            ],
          ).catch((err) => console.error("Notificación acompañante:", err));
        }
      }

      ctx.response.body = { ok: true, mensaje: `Cita marcada como ${estado}` };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al cambiar estado" };
    }
  },
};