// =====================================================================
// cambio: ARCHIVO NUEVO — Recordatorios automáticos de citas.
// Cada 15 minutos busca las citas CONFIRMADAS que empiezan en las
// próximas 24 horas y que todavía no tienen recordatorio. Al paciente
// (y a sus acompañantes) le llega una notificación y, si tiene activados
// los "Recordatorios por correo" en su perfil, también el correo.
// La columna citas.RecordatorioEnviado evita mandarlo dos veces.
// =====================================================================
import { conexion } from "../Model/conexion.ts";
import { EmailService } from "./EmailService.ts";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const CADA_MINUTOS = 15;
const FRONTEND = () => Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321";

// Personas a las que se les avisa: el paciente que agendó y sus acompañantes
async function destinatarios(citaId: string, pacientePerfilId: string) {
  return await conexion.query(
    `SELECT u.UsuarioId, u.NombreCompleto, u.Email,
            (SELECT a.Notificaciones FROM ajustesusuario a WHERE a.UsuarioId = u.UsuarioId LIMIT 1) AS Correos
     FROM perfilpaciente pp JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
     WHERE pp.PerfiluId = ? OR pp.PerfiluId IN (SELECT pc.PacienteId FROM participantescita pc WHERE pc.CitaId = ?)`,
    [pacientePerfilId, citaId],
  ) as Fila[];
}

export async function enviarRecordatorios() {
  let citas: Fila[] = [];
  try {
    citas = await conexion.query(
      `SELECT c.CitaId, c.PacienteId, c.Modalidad, c.Direccion,
              DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora,
              u.NombreCompleto AS Psicologo
       FROM citas c
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       WHERE c.Estado = 'Confirmada'
         AND c.RecordatorioEnviado = 0
         AND c.FechaHora > NOW()
         AND c.FechaHora <= DATE_ADD(NOW(), INTERVAL 24 HOUR)`,
    ) as Fila[];
  } catch (e) {
    console.error("Recordatorios: no se pudieron buscar las citas (¿falta la columna RecordatorioEnviado?)", e);
    return;
  }

  for (const c of citas) {
    // Se marca primero, así si el correo falla no se repite en bucle
    const r = await conexion.execute(
      `UPDATE citas SET RecordatorioEnviado = 1 WHERE CitaId = ? AND RecordatorioEnviado = 0`,
      [c.CitaId],
    );
    if ((r.affectedRows ?? 0) === 0) continue;

    const fh = texto(c.FechaHora); // "2026-10-26 08:00"
    const d = new Date(Date.UTC(+fh.slice(0, 4), +fh.slice(5, 7) - 1, +fh.slice(8, 10), 12));
    const fecha = d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const hh = +fh.slice(11, 13);
    const hora = `${((hh + 11) % 12) + 1}:${fh.slice(14, 16)} ${hh >= 12 ? "p. m." : "a. m."}`;
    const virtual = texto(c.Modalidad) === "Virtual";
    const lugar = virtual ? "" : texto(c.Direccion);

    for (const p of await destinatarios(texto(c.CitaId), texto(c.PacienteId))) {
      await conexion.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Recordatorio de cita', ?, 0, NOW())`,
        [
          crypto.randomUUID(),
          p.UsuarioId,
          `Tu cita con ${texto(c.Psicologo)} es el ${fecha} a las ${hora}.${lugar ? ` Lugar: ${lugar}.` : virtual ? " Podrás entrar a la sala 10 minutos antes." : ""}`,
        ],
      ).catch((e) => console.error("Recordatorio (notificación):", e));

      // Correo solo si no lo desactivó en su perfil (por defecto, activado)
      const quiereCorreo = p.Correos === null || p.Correos === undefined || Number(p.Correos) === 1;
      if (quiereCorreo && p.Email) {
        EmailService.enviarRecordatorioCita({
          to: texto(p.Email),
          nombreUsuario: texto(p.NombreCompleto),
          nombrePsicologo: texto(c.Psicologo),
          fecha,
          hora,
          enlaceVideollamada: virtual ? `${FRONTEND()}/Sala/${texto(c.CitaId)}` : undefined,
        }).catch((e) => console.error("Recordatorio (correo):", e));
      }
    }
  }
  if (citas.length) console.log(`Recordatorios: ${citas.length} cita(s) avisada(s).`);
}

// Arranca la revisión automática (la llama app.ts al iniciar)
export function iniciarRecordatorios() {
  setTimeout(() => void enviarRecordatorios(), 10_000); // una vez al arrancar
  setInterval(() => void enviarRecordatorios(), CADA_MINUTOS * 60_000);
}
