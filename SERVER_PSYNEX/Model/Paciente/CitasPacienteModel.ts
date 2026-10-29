// =====================================================================
// cambio: ARCHIVO NUEVO — acciones del paciente sobre sus citas:
//
// CANCELAR (solo quien agendó, antes de que empiece la cita):
//   - la cita queda 'Cancelada' (y el horario vuelve a quedar libre)
//   - si la pagó con su PAQUETE o con el BENEFICIO de su empresa, se le
//     devuelve la sesión
//   - si había un pago "en revisión", se quita
//   - si la pagó con dinero, el pago queda 'Reembolso' y se le avisa al
//     administrador para que haga la devolución
//   - se avisa al psicólogo (campanita + correo) y a los acompañantes
//
// CALIFICAR (titular o acompañante, después de la sesión):
//   - una sola reseña por persona y por cita (tabla calificacionescita)
// =====================================================================
import { conexion } from "../conexion.ts";
import { avisarAdmins } from "../../Helpers/AvisosAdmin.ts";
import { EmailService } from "../../Helpers/EmailService.ts";

type Fila = Record<string, unknown>;
type Resultado<T> = T | { error: string; status: number };
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

async function perfilPaciente(usuarioId: string) {
  const [f] = await conexion.query(
    `SELECT pp.PerfiluId, u.NombreCompleto FROM perfilpaciente pp
     JOIN usuarios u ON u.UsuarioId = pp.UsuarioId WHERE pp.UsuarioId = ? LIMIT 1`,
    [usuarioId],
  ) as Fila[];
  return f ? { perfilId: texto(f.PerfiluId), nombre: texto(f.NombreCompleto) } : null;
}

async function notificar(usuarioId: string, titulo: string, mensaje: string) {
  await conexion.execute(
    `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
     VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
    [crypto.randomUUID(), usuarioId, titulo, mensaje],
  ).catch((e) => console.error("Notificación:", e));
}

// "2026-10-29 09:00" -> "29/10/2026" y "9:00 a. m."
const partes = (fh: string) => {
  const hh = Number(fh.slice(11, 13));
  return {
    fecha: `${fh.slice(8, 10)}/${fh.slice(5, 7)}/${fh.slice(0, 4)}`,
    hora: `${((hh + 11) % 12) + 1}:${fh.slice(14, 16)} ${hh >= 12 ? "p. m." : "a. m."}`,
  };
};

export const CitasPacienteModel = {
  async cancelar(usuarioId: string, citaId: string, motivo: string): Promise<Resultado<{ reembolso: boolean; sesionDevuelta: string | null }>> {
    const pac = await perfilPaciente(usuarioId);
    if (!pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };

    const [cita] = await conexion.query(
      `SELECT c.CitaId, c.PacienteId, c.Estado, (c.FechaHora <= NOW()) AS YaEmpezo,
              DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora, c.Modalidad,
              ps.UsuarioId AS PsicologoUsuarioId, us.NombreCompleto AS Psicologo, us.Email AS PsicologoEmail
       FROM citas c
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios us ON us.UsuarioId = ps.UsuarioId
       WHERE c.CitaId = ? AND (c.PacienteId = ? OR EXISTS (
         SELECT 1 FROM participantescita pc WHERE pc.CitaId = c.CitaId AND pc.PacienteId = ?))
       LIMIT 1`,
      [citaId, pac.perfilId, pac.perfilId],
    ) as Fila[];
    if (!cita) return { error: "Cita no encontrada.", status: 404 };
    if (texto(cita.PacienteId) !== pac.perfilId) {
      return { error: "Solo quien agendó la cita puede cancelarla.", status: 403 };
    }
    if (!["Pendiente", "Confirmada"].includes(texto(cita.Estado))) {
      return { error: "Esta cita ya no se puede cancelar.", status: 409 };
    }
    if (Number(cita.YaEmpezo ?? 0) === 1) {
      return { error: "La cita ya empezó, no se puede cancelar.", status: 409 };
    }

    const r = await conexion.transaction(async (conn) => {
      await conn.execute(
        `UPDATE citas SET Estado = 'Cancelada', CanceladaEn = NOW() WHERE CitaId = ?`,
        [citaId],
      );

      const pagos = await conn.query(
        `SELECT PagoId, Origen, CompraId, EstadoPago, MontoTotal, ReferenciaPasarela, Pasarela
         FROM pagos WHERE CitaId = ? FOR UPDATE`,
        [citaId],
      ) as Fila[];

      let reembolso: Fila | null = null;
      let sesionDevuelta: string | null = null;

      for (const p of pagos) {
        const origen = texto(p.Origen);
        const estado = texto(p.EstadoPago);
        if (estado === "Pendiente") {
          // pago en revisión o intento de Wompi sin terminar: se quita
          await conn.execute(`DELETE FROM pagos WHERE PagoId = ?`, [p.PagoId]);
        } else if (estado === "Completado" && origen === "Paquete" && p.CompraId) {
          await conn.execute(
            `UPDATE comprasplanes SET SesionesUsadas = GREATEST(SesionesUsadas - 1, 0) WHERE CompraId = ?`,
            [p.CompraId],
          );
          await conn.execute(`DELETE FROM pagos WHERE PagoId = ?`, [p.PagoId]);
          sesionDevuelta = "paquete";
        } else if (estado === "Completado" && origen === "Empresarial") {
          // ReferenciaPasarela guarda el código de la empresa con el que se pagó
          await conn.execute(
            `UPDATE empleadosvinculados e
             JOIN codigosvinculacion cv ON cv.ContratoId = e.ContratoId
             SET e.SesionesUsadas = GREATEST(e.SesionesUsadas - 1, 0)
             WHERE e.UsuarioId = ? AND cv.Codigo = ?`,
            [usuarioId, texto(p.ReferenciaPasarela)],
          );
          await conn.execute(`DELETE FROM pagos WHERE PagoId = ?`, [p.PagoId]);
          sesionDevuelta = "empresa";
        } else if (estado === "Completado") {
          // Pagó con dinero: queda para que el administrador lo devuelva
          await conn.execute(`UPDATE pagos SET EstadoPago = 'Reembolso' WHERE PagoId = ?`, [p.PagoId]);
          reembolso = p;
        }
      }
      return { reembolso, sesionDevuelta };
    });

    const fh = texto(cita.FechaHora);
    const { fecha, hora } = partes(fh);
    const textoMotivo = motivo ? ` Motivo: ${motivo}` : "";

    // Psicólogo: campanita + correo
    await notificar(
      texto(cita.PsicologoUsuarioId),
      "Cita cancelada por el paciente",
      `${pac.nombre} canceló la cita del ${fecha} a las ${hora}.${textoMotivo}`,
    );
    if (cita.PsicologoEmail) {
      EmailService.enviarCancelacionCita({
        to: texto(cita.PsicologoEmail),
        nombreUsuario: texto(cita.Psicologo),
        fecha,
        hora,
        motivo: `Cancelada por ${pac.nombre}${motivo ? `: ${motivo}` : ""}`,
        ruta: "/Psicologos/Citas",
        boton: "Ver mis citas",
      }).catch((e) => console.error("Email cancelación al psicólogo:", e));
    }

    // Acompañantes (terapia de pareja o familiar)
    const acompanantes = await conexion.query(
      `SELECT pp.UsuarioId FROM participantescita pc
       JOIN perfilpaciente pp ON pp.PerfiluId = pc.PacienteId
       WHERE pc.CitaId = ? AND pc.PacienteId <> ?`,
      [citaId, pac.perfilId],
    ) as Fila[];
    for (const a of acompanantes) {
      await notificar(texto(a.UsuarioId), "Cita cancelada", `${pac.nombre} canceló la cita del ${fecha} a las ${hora} con ${texto(cita.Psicologo)}.`);
    }

    // Si pagó con dinero, el administrador hace la devolución
    if (r.reembolso) {
      await avisarAdmins(
        "Reembolso por revisar",
        `${pac.nombre} canceló una cita que ya había pagado. Revisa la devolución del dinero.`,
        "/Administrador/pagospacientes",
        {
          boton: "Ver pagos de pacientes",
          detalles: [
            ["Paciente", pac.nombre],
            ["Psicólogo", texto(cita.Psicologo)],
            ["Cita", `${fecha} · ${hora}`],
            ["Valor", pesos(Number(r.reembolso.MontoTotal ?? 0))],
            ["Referencia", texto(r.reembolso.ReferenciaPasarela) || "—"],
          ],
        },
      );
    }

    return { reembolso: r.reembolso !== null, sesionDevuelta: r.sesionDevuelta };
  },

  async calificar(usuarioId: string, citaId: string, puntaje: number, comentario: string): Promise<Resultado<{ ok: true }>> {
    const pac = await perfilPaciente(usuarioId);
    if (!pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };

    const [cita] = await conexion.query(
      `SELECT c.CitaId, c.Estado, (DATE_ADD(c.FechaHora, INTERVAL c.DuracionMinutos MINUTE) <= NOW()) AS Termino,
              ps.UsuarioId AS PsicologoUsuarioId,
              (SELECT COUNT(*) FROM calificacionescita cc WHERE cc.CitaId = c.CitaId AND cc.PacienteId = ?) AS Calificada
       FROM citas c
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       WHERE c.CitaId = ? AND (c.PacienteId = ? OR EXISTS (
         SELECT 1 FROM participantescita pc WHERE pc.CitaId = c.CitaId AND pc.PacienteId = ?))
       LIMIT 1`,
      [pac.perfilId, citaId, pac.perfilId, pac.perfilId],
    ) as Fila[];
    if (!cita) return { error: "Cita no encontrada.", status: 404 };

    const estado = texto(cita.Estado);
    const yaPaso = estado === "Completada" || (estado === "Confirmada" && Number(cita.Termino ?? 0) === 1);
    if (!yaPaso) return { error: "Podrás calificar la cita cuando termine la sesión.", status: 409 };
    if (Number(cita.Calificada ?? 0) > 0) return { error: "Ya calificaste esta cita.", status: 409 };

    await conexion.execute(
      `INSERT INTO calificacionescita (CalificacionId, CitaId, PacienteId, Puntaje, Comentario, CreadoEn)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [crypto.randomUUID(), citaId, pac.perfilId, puntaje, comentario || null],
    );

    await notificar(
      texto(cita.PsicologoUsuarioId),
      "Nueva reseña",
      `Un paciente calificó su sesión con ${puntaje} de 5 estrellas.`,
    );
    return { ok: true };
  },
};
