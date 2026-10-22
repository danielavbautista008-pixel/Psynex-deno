import type { Context, RouterContext } from "../../Dependencies/dependencias.ts";
import {
  listarCitasPsicologoSchema,
  cambiarEstadoCitaSchema,
} from "../../Validators/Psicologo/CitasPsicologoValidator.ts";
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

      const { estado, motivo, linkVideollamada } = validacion.data;

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
        { linkVideollamada },
      );
      if (!ok) {
        ctx.response.status = 400;
        ctx.response.body = { ok: false, error: "No se pudo actualizar la cita" };
        return;
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

      ctx.response.body = { ok: true, mensaje: `Cita marcada como ${estado}` };
    } catch (e) {
      console.error(e);
      ctx.response.status = 500;
      ctx.response.body = { ok: false, error: "Error al cambiar estado" };
    }
  },
};