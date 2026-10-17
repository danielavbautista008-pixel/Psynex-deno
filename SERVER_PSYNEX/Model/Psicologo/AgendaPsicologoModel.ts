import { conexion } from "../conexion.ts";
import type { ConfiguracionAgendaInput } from "../../Validators/Psicologo/AgendaPsicologoValidator.ts";

// Valores por defecto (los mismos que trae seleccionados la vista Agenda)
const POR_DEFECTO = {
  duracionMinutos: 45,
  anticipacionHoras: 12,
  cancelacionHoras: 12,
  modalidades: ["Virtual", "Presencial"],
  tiposConsulta: [] as string[],
};

const lista = (texto: unknown) =>
  String(texto ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export const AgendaPsicologoModel = {

  // Citas de un mes (AAAA-MM) para el calendario. No incluye canceladas.
  async citasDelMes(perfilId: string, mes: string) {
    const desde = `${mes}-01 00:00:00`;
    return await conexion.query(
      `SELECT c.CitaId, c.FechaHora, c.DuracionMinutos, c.Modalidad, c.TipoCita, c.Estado,
              c.LinkVideollamada,
              CASE WHEN pp.EsAnonimo = 1 THEN 'Paciente anónimo'
                   ELSE COALESCE(u.NombreCompleto, 'Paciente') END AS PacienteNombre,
              c.PacienteId
       FROM citas c
       LEFT JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE c.PsicologoId = ?
         AND c.Estado <> 'Cancelada'
         AND c.FechaHora >= ?
         AND c.FechaHora < DATE_ADD(?, INTERVAL 1 MONTH)
       ORDER BY c.FechaHora`,
      [perfilId, desde, desde],
    );
  },

  async obtenerConfiguracion(perfilId: string) {
    const dias = await conexion.query(
      `SELECT DiaSemana, TIME_FORMAT(HoraInicio, '%H:%i') AS HoraInicio,
              TIME_FORMAT(HoraFin, '%H:%i') AS HoraFin
       FROM disponibilidadpsicologo
       WHERE PerfildId = ? AND TipoConfiguracion = 'Fija' AND EstaActiva = 1`,
      [perfilId],
    );
    const [config] = await conexion.query(
      `SELECT DuracionMinutos, AnticipacionHoras, CancelacionHoras, Modalidades, TiposConsulta
       FROM configuracionagenda WHERE PerfilId = ? LIMIT 1`,
      [perfilId],
    );

    return {
      dias: dias.map((d: { DiaSemana: string }) => d.DiaSemana),
      // Todos los días comparten horario en la vista; se toma el primero
      horaInicio: dias[0]?.HoraInicio ?? "08:00",
      horaFin: dias[0]?.HoraFin ?? "17:00",
      duracionMinutos: Number(config?.DuracionMinutos ?? POR_DEFECTO.duracionMinutos),
      anticipacionHoras: Number(config?.AnticipacionHoras ?? POR_DEFECTO.anticipacionHoras),
      cancelacionHoras: Number(config?.CancelacionHoras ?? POR_DEFECTO.cancelacionHoras),
      modalidades: config ? lista(config.Modalidades) : POR_DEFECTO.modalidades,
      tiposConsulta: config ? lista(config.TiposConsulta) : POR_DEFECTO.tiposConsulta,
      configurada: Boolean(config),
    };
  },

  // Guarda toda la configuración en una transacción:
  // reemplaza los días fijos y actualiza (o crea) las preferencias.
  async guardarConfiguracion(perfilId: string, c: ConfiguracionAgendaInput) {
    await conexion.transaction(async (conn) => {
      await conn.execute(
        `DELETE FROM disponibilidadpsicologo WHERE PerfildId = ? AND TipoConfiguracion = 'Fija'`,
        [perfilId],
      );
      for (const dia of c.dias) {
        await conn.execute(
          `INSERT INTO disponibilidadpsicologo
             (DisponibilidadId, PerfildId, TipoConfiguracion, DiaSemana, FechaEspecifica,
              HoraInicio, HoraFin, EstaActiva, CreadoEn)
           VALUES (?, ?, 'Fija', ?, NULL, ?, ?, 1, NOW())`,
          [crypto.randomUUID(), perfilId, dia, c.horaInicio, c.horaFin],
        );
      }
      await conn.execute(
        `INSERT INTO configuracionagenda
           (PerfilId, DuracionMinutos, AnticipacionHoras, CancelacionHoras, Modalidades, TiposConsulta, ActualizadoEn)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           DuracionMinutos = VALUES(DuracionMinutos),
           AnticipacionHoras = VALUES(AnticipacionHoras),
           CancelacionHoras = VALUES(CancelacionHoras),
           Modalidades = VALUES(Modalidades),
           TiposConsulta = VALUES(TiposConsulta),
           ActualizadoEn = NOW()`,
        [
          perfilId,
          c.duracionMinutos,
          c.anticipacionHoras,
          c.cancelacionHoras,
          c.modalidades.join(","),
          c.tiposConsulta.join(","),
        ],
      );
    });
  },
};
