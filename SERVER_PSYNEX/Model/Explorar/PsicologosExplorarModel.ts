import { conexion } from "../conexion.ts";
import type { AgendarCitaInput, ListarPsicologosQuery, ResenaInput } from "../../Validators/Explorar/ExplorarValidator.ts";
import { ahoraColombia, aMinutos, desdeMinutos, diaSemana, horaCorta, sumarDias } from "../../Helpers/Fechas.ts";

type Fila = Record<string, unknown>;

// Solo se muestran al público los psicólogos verificados y con cuenta activa.
const SOLO_PUBLICOS = `p.EstaVerificado = 1 AND u.EstadoActivo = 1 AND u.Rol = 'Psicologo'`;

// Valores por defecto si el psicólogo todavía no configuró su agenda
const AGENDA_POR_DEFECTO = { duracion: 45, anticipacionHoras: 12 };

// ---------------------------------------------------------------------
// Ayudas para armar la respuesta (texto listo para la vista)
// ---------------------------------------------------------------------

// Modalidades que atiende: primero lo que configuró en la agenda,
// si no, lo que dice su perfil ("Ambas" = las dos).
function modalidadesDe(f: Fila): string[] {
  const deAgenda = String(f.Modalidades ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (deAgenda.length) return deAgenda;
  const perfil = String(f.Modalidad ?? "Virtual");
  return perfil === "Ambas" ? ["Virtual", "Presencial"] : [perfil];
}

const textoModalidades = (m: string[]) =>
  m.length > 1 ? "Virtual y presencial" : (m[0] ?? "Virtual");

function aniosDesde(fecha: unknown): number | null {
  if (!fecha) return null;
  const inicio = new Date(String(fecha));
  if (isNaN(inicio.getTime())) return null;
  const anios = Math.floor((Date.now() - inicio.getTime()) / (365.25 * 24 * 3600 * 1000));
  return Math.max(anios, 0);
}

const textoExperiencia = (anios: number | null) =>
  anios === null ? "Experiencia por confirmar" : anios === 1 ? "1 año de experiencia" : `${anios} años de experiencia`;

// "Disponible hoy" / "Disponible esta semana" según los días que atiende
function textoDisponibilidad(diasAtencion: string[]) {
  if (!diasAtencion.length) return { codigo: "sin-horario", texto: "Agenda por confirmar" };
  const hoy = ahoraColombia().fecha;
  if (diasAtencion.includes(diaSemana(hoy))) return { codigo: "hoy", texto: "Disponible hoy" };
  for (let i = 1; i < 7; i++) {
    if (diasAtencion.includes(diaSemana(sumarDias(hoy, i)))) {
      return { codigo: "semana", texto: "Disponible esta semana" };
    }
  }
  return { codigo: "sin-horario", texto: "Agenda por confirmar" };
}

// Solo el primer nombre de quien dejó la reseña (privacidad del paciente)
const primerNombre = (nombre: unknown) => String(nombre ?? "Paciente").trim().split(/\s+/)[0] || "Paciente";

// Columnas comunes del listado y del perfil
const SELECT_PSICOLOGO = `
  SELECT p.PerfilId, u.NombreCompleto, p.Biografia, p.Modalidad, p.TipoServicio,
         p.PrecioPorHora, p.ServicioVoluntario, p.Direccion,
         (p.Foto IS NOT NULL AND p.Foto LIKE 'data:image/%') AS TieneFoto,
         -- cambio: "versión" de la foto (cambia cuando cambia la foto); va en la URL
         -- para que el navegador no muestre la foto vieja guardada en su caché
         CRC32(p.Foto) AS FotoVersion,
         ca.Modalidades, ca.DuracionMinutos,
         (SELECT e.Titulo FROM estudios e WHERE e.PerfilId = p.PerfilId
           ORDER BY e.EnCurso ASC, e.FechaGrado DESC LIMIT 1) AS Titulo,
         (SELECT MIN(x.FechaInicio) FROM experiencia x WHERE x.PerfileId = p.PerfilId) AS InicioExperiencia,
         (SELECT ROUND(AVG(cc.Puntaje), 1) FROM calificacionescita cc
            JOIN citas c ON c.CitaId = cc.CitaId WHERE c.PsicologoId = p.PerfilId) AS Calificacion,
         (SELECT COUNT(*) FROM calificacionescita cc
            JOIN citas c ON c.CitaId = cc.CitaId WHERE c.PsicologoId = p.PerfilId) AS TotalResenas,
         (SELECT GROUP_CONCAT(DISTINCT d.DiaSemana) FROM disponibilidadpsicologo d
           WHERE d.PerfildId = p.PerfilId AND d.EstaActiva = 1 AND d.TipoConfiguracion = 'Fija') AS DiasAtencion
  FROM perfilpsicologo p
  JOIN usuarios u ON u.UsuarioId = p.UsuarioId
  LEFT JOIN configuracionagenda ca ON ca.PerfilId = p.PerfilId
`;

// Convierte una fila de la BD en el objeto que usa la vista
function armarPsicologo(f: Fila, especialidades: string[]) {
  const modalidades = modalidadesDe(f);
  const anios = aniosDesde(f.InicioExperiencia);
  const dias = String(f.DiasAtencion ?? "").split(",").filter(Boolean);
  const disponibilidad = textoDisponibilidad(dias);
  const precio = Number(f.PrecioPorHora ?? 0);
  return {
    id: String(f.PerfilId),
    nombre: String(f.NombreCompleto),
    titulo: String(f.Titulo ?? "") || "Psicólogo/a",
    biografia: String(f.Biografia ?? ""),
    especialidades,
    modalidades,
    modalidadTexto: textoModalidades(modalidades),
    aniosExperiencia: anios,
    experienciaTexto: textoExperiencia(anios),
    diasAtencion: dias,
    disponibilidad: disponibilidad.codigo,
    disponibilidadTexto: disponibilidad.texto,
    calificacion: f.Calificacion === null || f.Calificacion === undefined ? null : Number(f.Calificacion),
    totalResenas: Number(f.TotalResenas ?? 0),
    precio,
    voluntario: Number(f.ServicioVoluntario ?? 0) === 1 || String(f.TipoServicio) === "Voluntario",
    duracionMinutos: Number(f.DuracionMinutos ?? AGENDA_POR_DEFECTO.duracion),
    // La foto se pide aparte (es pesada): /api/explorar/psicologos/:id/foto
    tieneFoto: Number(f.TieneFoto ?? 0) === 1,
    fotoVersion: f.FotoVersion === null || f.FotoVersion === undefined ? "" : String(f.FotoVersion),
  };
}

async function especialidadesDe(ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (!ids.length) return mapa;
  const filas = await conexion.query(
    `SELECT pe.PerfilId, e.NombreEspecialidad
     FROM psicologoespecialidad pe
     JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
     WHERE e.EstaActiva = 1 AND pe.PerfilId IN (${ids.map(() => "?").join(",")})
     ORDER BY e.NombreEspecialidad`,
    ids,
  ) as Fila[];
  for (const f of filas) {
    const lista = mapa.get(String(f.PerfilId)) ?? [];
    lista.push(String(f.NombreEspecialidad));
    mapa.set(String(f.PerfilId), lista);
  }
  return mapa;
}

// ---------------------------------------------------------------------
// Cálculo de horarios libres (lo usa el modal "Agendar cita")
// ---------------------------------------------------------------------
interface DiaDisponible {
  fecha: string; // "2026-10-15"
  dia: string; // "Jueves"
  horas: string[]; // ["08:00", "08:45", ...]
}

async function calcularDisponibilidad(perfilId: string, desde: string, dias: number): Promise<DiaDisponible[]> {
  const [config] = await conexion.query(
    `SELECT DuracionMinutos, AnticipacionHoras FROM configuracionagenda WHERE PerfilId = ? LIMIT 1`,
    [perfilId],
  ) as Fila[];
  const duracion = Number(config?.DuracionMinutos ?? AGENDA_POR_DEFECTO.duracion);
  const anticipacion = Number(config?.AnticipacionHoras ?? AGENDA_POR_DEFECTO.anticipacionHoras);

  // Bloques de atención: fijos por día de la semana o en fechas puntuales
  const bloques = await conexion.query(
    `SELECT TipoConfiguracion, DiaSemana,
            DATE_FORMAT(FechaEspecifica, '%Y-%m-%d') AS Fecha,
            TIME_FORMAT(HoraInicio, '%H:%i') AS HoraInicio,
            TIME_FORMAT(HoraFin, '%H:%i') AS HoraFin
     FROM disponibilidadpsicologo
     WHERE PerfildId = ? AND EstaActiva = 1`,
    [perfilId],
  ) as Fila[];

  const hasta = sumarDias(desde, dias);

  // Citas que ya ocupan la agenda (las canceladas y completadas no cuentan)
  const ocupadas = (await conexion.query(
    `SELECT DATE_FORMAT(FechaHora, '%Y-%m-%d') AS Fecha,
            DATE_FORMAT(FechaHora, '%H:%i') AS Hora, DuracionMinutos
     FROM citas
     WHERE PsicologoId = ? AND Estado IN ('Pendiente', 'Confirmada')
       AND FechaHora >= ? AND FechaHora < ?`,
    [perfilId, `${desde} 00:00:00`, `${hasta} 00:00:00`],
  ) as Fila[]).map((c) => {
    const inicio = aMinutos(String(c.Fecha), String(c.Hora));
    return { inicio, fin: inicio + Number(c.DuracionMinutos ?? duracion) };
  });

  const ahora = ahoraColombia();
  const minimo = aMinutos(ahora.fecha, ahora.hora) + anticipacion * 60;

  const resultado: DiaDisponible[] = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    const nombreDia = diaSemana(fecha);
    const delDia = bloques.filter((b) =>
      (b.TipoConfiguracion === "Fija" && b.DiaSemana === nombreDia) || b.Fecha === fecha
    );

    const horas = new Set<string>();
    for (const b of delDia) {
      const fin = aMinutos(fecha, horaCorta(String(b.HoraFin)));
      for (let t = aMinutos(fecha, horaCorta(String(b.HoraInicio))); t + duracion <= fin; t += duracion) {
        if (t < minimo) continue;
        const choca = ocupadas.some((c) => t < c.fin && c.inicio < t + duracion);
        if (!choca) horas.add(desdeMinutos(t).hora);
      }
    }
    if (horas.size) resultado.push({ fecha, dia: nombreDia, horas: [...horas].sort() });
  }
  return resultado;
}

// ---------------------------------------------------------------------
export const PsicologosExplorarModel = {

  // Lista pública con filtros opcionales
  async listar(f: ListarPsicologosQuery) {
    const condiciones = [SOLO_PUBLICOS];
    const params: string[] = [];

    if (f.busqueda) {
      condiciones.push(`(u.NombreCompleto LIKE ? OR p.Biografia LIKE ? OR EXISTS (
        SELECT 1 FROM psicologoespecialidad pe JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
        WHERE pe.PerfilId = p.PerfilId AND e.NombreEspecialidad LIKE ?))`);
      const like = `%${f.busqueda}%`;
      params.push(like, like, like);
    }
    if (f.especialidad) {
      condiciones.push(`EXISTS (
        SELECT 1 FROM psicologoespecialidad pe JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
        WHERE pe.PerfilId = p.PerfilId AND e.NombreEspecialidad = ?)`);
      params.push(f.especialidad);
    }
    if (f.modalidad !== "todas") {
      condiciones.push(`(ca.Modalidades LIKE ? OR (ca.Modalidades IS NULL AND p.Modalidad IN (?, 'Ambas')))`);
      params.push(`%${f.modalidad}%`, f.modalidad);
    }

    const filas = await conexion.query(
      `${SELECT_PSICOLOGO} WHERE ${condiciones.join(" AND ")} ORDER BY u.NombreCompleto`,
      params,
    ) as Fila[];

    const especialidades = await especialidadesDe(filas.map((x) => String(x.PerfilId)));
    return filas.map((x) => armarPsicologo(x, especialidades.get(String(x.PerfilId)) ?? []));
  },

  // Especialidades activas que tiene al menos un psicólogo público (para el filtro)
  async especialidadesConPsicologos() {
    const filas = await conexion.query(
      `SELECT DISTINCT e.NombreEspecialidad
       FROM especialidades e
       JOIN psicologoespecialidad pe ON pe.EspecialidadId = e.EspecialidadId
       JOIN perfilpsicologo p ON p.PerfilId = pe.PerfilId
       JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       WHERE e.EstaActiva = 1 AND ${SOLO_PUBLICOS}
       ORDER BY e.NombreEspecialidad`,
    ) as Fila[];
    return filas.map((f) => String(f.NombreEspecialidad));
  },

  // Perfil completo: datos, estudios, experiencia y reseñas
  async perfil(perfilId: string) {
    const [fila] = await conexion.query(
      `${SELECT_PSICOLOGO} WHERE p.PerfilId = ? AND ${SOLO_PUBLICOS} LIMIT 1`,
      [perfilId],
    ) as Fila[];
    if (!fila) return null;

    const especialidades = await especialidadesDe([perfilId]);

    const estudios = await conexion.query(
      `SELECT Universidad, Titulo, NivelEstudio, YEAR(FechaGrado) AS AnioGrado, EnCurso
       FROM estudios WHERE PerfilId = ?
       ORDER BY EnCurso DESC, FechaGrado DESC`,
      [perfilId],
    );

    const experiencia = await conexion.query(
      `SELECT Empresa, Cargo, Descripcion, YEAR(FechaInicio) AS AnioInicio,
              YEAR(FechaFin) AS AnioFin, TrabajaAqui
       FROM experiencia WHERE PerfileId = ?
       ORDER BY TrabajaAqui DESC, FechaInicio DESC`,
      [perfilId],
    );

    const resenas = (await conexion.query(
      `SELECT cc.Puntaje, cc.Comentario, cc.CreadoEn, u.NombreCompleto
       FROM calificacionescita cc
       JOIN citas c ON c.CitaId = cc.CitaId
       LEFT JOIN perfilpaciente pp ON pp.PerfiluId = cc.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE c.PsicologoId = ? AND cc.Comentario IS NOT NULL AND TRIM(cc.Comentario) <> ''
       ORDER BY cc.CreadoEn DESC
       LIMIT 10`,
      [perfilId],
    ) as Fila[]).map((r) => ({
      nombre: primerNombre(r.NombreCompleto),
      puntaje: Number(r.Puntaje),
      comentario: String(r.Comentario),
      fecha: r.CreadoEn,
    }));

    // Horario semanal de atención (lo que configuró en su agenda)
    const horarios = (await conexion.query(
      `SELECT DiaSemana, TIME_FORMAT(HoraInicio, '%H:%i') AS Desde, TIME_FORMAT(HoraFin, '%H:%i') AS Hasta
       FROM disponibilidadpsicologo
       WHERE PerfildId = ? AND EstaActiva = 1 AND TipoConfiguracion = 'Fija' AND DiaSemana IS NOT NULL
       ORDER BY FIELD(DiaSemana, 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'), HoraInicio`,
      [perfilId],
    ) as Fila[]).map((h) => ({ dia: String(h.DiaSemana), desde: String(h.Desde), hasta: String(h.Hasta) }));

    return {
      ...armarPsicologo(fila, especialidades.get(perfilId) ?? []),
      direccion: String(fila.Direccion ?? ""),
      estudios,
      experiencia,
      resenas,
      horarios,
    };
  },

  // Foto guardada como "data:image/jpeg;base64,...." -> bytes de la imagen
  async foto(perfilId: string) {
    const [fila] = await conexion.query(
      `SELECT p.Foto FROM perfilpsicologo p JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       WHERE p.PerfilId = ? AND ${SOLO_PUBLICOS} LIMIT 1`,
      [perfilId],
    ) as Fila[];
    return decodificarDataUrl(fila?.Foto);
  },

  async disponibilidad(perfilId: string, dias: number) {
    const existe = await conexion.query(
      `SELECT 1 FROM perfilpsicologo p JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       WHERE p.PerfilId = ? AND ${SOLO_PUBLICOS} LIMIT 1`,
      [perfilId],
    );
    if (!existe.length) return null;
    return await calcularDisponibilidad(perfilId, ahoraColombia().fecha, dias);
  },

  // Un paciente con sesión pide una cita. Queda "Pendiente" hasta que el
  // psicólogo la confirme (el pago con Wompi se conecta más adelante).
  async agendar(usuarioId: string, perfilId: string, d: AgendarCitaInput) {
    const [psicologo] = await conexion.query(
      `SELECT p.PerfilId, p.UsuarioId, p.Modalidad, ca.Modalidades, ca.DuracionMinutos
       FROM perfilpsicologo p
       JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       LEFT JOIN configuracionagenda ca ON ca.PerfilId = p.PerfilId
       WHERE p.PerfilId = ? AND ${SOLO_PUBLICOS} LIMIT 1`,
      [perfilId],
    ) as Fila[];
    if (!psicologo) return { error: "Psicólogo no encontrado", status: 404 };

    if (!modalidadesDe(psicologo).includes(d.modalidad)) {
      return { error: `Este psicólogo no atiende en modalidad ${d.modalidad.toLowerCase()}`, status: 400 };
    }

    const [paciente] = await conexion.query(
      `SELECT PerfiluId FROM perfilpaciente WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (!paciente) return { error: "Completa tu perfil de paciente antes de agendar", status: 403 };
    const pacienteId = String(paciente.PerfiluId);

    // Acompañantes (pareja o familia): deben tener cuenta de paciente activa
    let acompanantes: { usuarioId: string; perfilId: string }[] = [];
    if (d.acompanantes.length) {
      const filas = await conexion.query(
        `SELECT u.UsuarioId, LOWER(u.Email) AS Email, pp.PerfiluId
         FROM usuarios u JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
         WHERE LOWER(u.Email) IN (${d.acompanantes.map(() => "?").join(", ")})
           AND u.Rol = 'Paciente' AND u.EstadoActivo = 1`,
        d.acompanantes,
      ) as Fila[];
      const encontrados = new Map(filas.map((f) => [String(f.Email), f]));
      const faltan = d.acompanantes.filter((c) => !encontrados.has(c));
      if (faltan.length) {
        return {
          error: `${faltan.length === 1 ? "Este correo no tiene" : "Estos correos no tienen"} cuenta de paciente en Psynex: ${faltan.join(", ")}. Pídeles que se registren primero.`,
          status: 400,
        };
      }
      acompanantes = filas.map((f) => ({ usuarioId: String(f.UsuarioId), perfilId: String(f.PerfiluId) }));
      if (acompanantes.some((a) => a.perfilId === pacienteId)) {
        return { error: "No escribas tu propio correo como acompañante.", status: 400 };
      }
    }

    // ¿Ese horario sigue libre? (se recalcula con las reglas del psicólogo)
    const [dia] = await calcularDisponibilidad(perfilId, d.fecha, 1);
    if (!dia || dia.fecha !== d.fecha || !dia.horas.includes(d.hora)) {
      return { error: "Ese horario ya no está disponible. Elige otro.", status: 409 };
    }

    const duracion = Number(psicologo.DuracionMinutos ?? AGENDA_POR_DEFECTO.duracion);
    const inicio = `${d.fecha} ${d.hora}:00`;
    const citaId = crypto.randomUUID();

    const r = await conexion.transaction(async (conn) => {
      // Se vuelve a revisar dentro de la transacción (FOR UPDATE bloquea
      // las filas) por si otra persona pidió el mismo horario al tiempo.
      const choques = await conn.query(
        `SELECT CitaId FROM citas
         WHERE Estado IN ('Pendiente', 'Confirmada')
           AND (PsicologoId = ? OR PacienteId = ?)
           AND FechaHora < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(FechaHora, INTERVAL DuracionMinutos MINUTE) > ?
         FOR UPDATE`,
        [perfilId, pacienteId, inicio, duracion, inicio],
      ) as Fila[];
      if (choques.length) return { error: "Ese horario ya no está disponible. Elige otro.", status: 409 };

      await conn.execute(
        `INSERT INTO citas
           (CitaId, PacienteId, PsicologoId, FechaHora, DuracionMinutos, Modalidad,
            TipoCita, Formato, Estado, RazonConsulta, LinkVideollamada, CreadoEn)
         VALUES (?, ?, ?, ?, ?, ?, 'Individual', ?, 'Pendiente', ?, NULL, NOW())`,
        [citaId, pacienteId, perfilId, inicio, duracion, d.modalidad, d.formato, d.motivo ?? ""],
      );
      for (const a of acompanantes) {
        await conn.execute(
          `INSERT INTO participantescita (ParticipanteId, CitaId, PacienteId, AgregadoEn) VALUES (?, ?, ?, NOW())`,
          [crypto.randomUUID(), citaId, a.perfilId],
        );
      }
      const tipo = d.formato === "Individual" ? "" : ` de ${d.formato === "Pareja" ? "pareja" : "familia"}`;
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Nueva solicitud de cita', ?, 0, NOW())`,
        [
          crypto.randomUUID(),
          psicologo.UsuarioId,
          `Tienes una nueva solicitud de cita${tipo} ${d.modalidad.toLowerCase()} para el ${d.fecha} a las ${d.hora}.`,
        ],
      );
      // Aviso a cada acompañante
      for (const a of acompanantes) {
        await conn.execute(
          `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
           VALUES (?, ?, 'Sistema', 'Te agregaron a una cita', ?, 0, NOW())`,
          [
            crypto.randomUUID(),
            a.usuarioId,
            `Te agregaron a una cita${tipo} ${d.modalidad.toLowerCase()} el ${d.fecha} a las ${d.hora}. Te avisaremos cuando el psicólogo la confirme.`,
          ],
        );
      }
      return { citaId };
    });
    return r;
  },
  // ------------------------------------------------------------------
  // Reseñas: un paciente califica una sesión que de verdad tuvo con el
  // psicólogo (la tabla calificacionescita está ligada a una cita).
  //   "puede"    -> tiene una sesión ya realizada sin calificar
  //   "ya"       -> ya calificó todas sus sesiones con este psicólogo
  //   "sin-cita" -> todavía no ha tenido una sesión con él
  // ------------------------------------------------------------------
  async estadoResena(usuarioId: string, perfilId: string) {
    const [pac] = await conexion.query(
      `SELECT PerfiluId FROM perfilpaciente WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (!pac) return { estado: "sin-cita" as const };
    const pacienteId = String(pac.PerfiluId);

    // Citas donde estuvo (como paciente principal o como acompañante)
    // y que todavía no ha calificado él mismo
    const [cita] = await conexion.query(
      `SELECT c.CitaId FROM citas c
       LEFT JOIN calificacionescita cc ON cc.CitaId = c.CitaId AND cc.PacienteId = ?
       WHERE c.PsicologoId = ? AND cc.CalificacionId IS NULL
         AND (c.PacienteId = ? OR EXISTS (
               SELECT 1 FROM participantescita pc WHERE pc.CitaId = c.CitaId AND pc.PacienteId = ?))
         AND (c.Estado = 'Completada' OR (c.Estado = 'Confirmada' AND c.FechaHora < NOW()))
       ORDER BY c.FechaHora DESC LIMIT 1`,
      [pacienteId, perfilId, pacienteId, pacienteId],
    ) as Fila[];
    if (cita) return { estado: "puede" as const, citaId: String(cita.CitaId), pacienteId };

    const [ya] = await conexion.query(
      `SELECT COUNT(*) AS n FROM calificacionescita cc JOIN citas c ON c.CitaId = cc.CitaId
       WHERE c.PsicologoId = ? AND cc.PacienteId = ?`,
      [perfilId, pacienteId],
    ) as Fila[];
    return { estado: Number(ya?.n ?? 0) > 0 ? "ya" as const : "sin-cita" as const };
  },

  async crearResena(usuarioId: string, perfilId: string, d: ResenaInput) {
    const e = await this.estadoResena(usuarioId, perfilId);
    if (e.estado !== "puede") {
      return {
        error: e.estado === "ya"
          ? "Ya calificaste tus sesiones con este psicólogo."
          : "Podrás calificar después de tener una sesión con este psicólogo.",
        status: 409,
      };
    }
    await conexion.execute(
      `INSERT INTO calificacionescita (CalificacionId, CitaId, PacienteId, Puntaje, Comentario, CreadoEn)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [crypto.randomUUID(), e.citaId, e.pacienteId, d.puntaje, d.comentario || null],
    );

    // Aviso al psicólogo en su campana
    const [psi] = await conexion.query(
      `SELECT UsuarioId FROM perfilpsicologo WHERE PerfilId = ? LIMIT 1`,
      [perfilId],
    ) as Fila[];
    if (psi?.UsuarioId) {
      await conexion.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Nueva reseña', ?, 0, NOW())`,
        [crypto.randomUUID(), psi.UsuarioId, `Un paciente calificó su sesión con ${d.puntaje} de 5 estrellas.`],
      ).catch((err) => console.error("Notificación de reseña:", err));
    }
    return { ok: true as const };
  },
};

// "data:image/png;base64,AAAA" -> { mime, bytes } (o null si no es una imagen válida)
export function decodificarDataUrl(valor: unknown): { mime: string; bytes: Uint8Array } | null {
  const texto = typeof valor === "string" ? valor : "";
  const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(texto);
  if (!m) return null;
  try {
    const binario = atob(m[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return { mime: m[1] === "image/jpg" ? "image/jpeg" : m[1], bytes };
  } catch {
    return null;
  }
}
