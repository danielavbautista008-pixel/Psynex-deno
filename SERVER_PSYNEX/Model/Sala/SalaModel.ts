// =====================================================================
// Model/Sala/SalaModel.ts
// Datos de la cita para la sala de videollamada de Psynex.
// Una cita puede ser Individual, de Pareja o Familiar: el paciente
// principal está en citas.PacienteId y sus acompañantes en
// participantescita (máximo 6 personas con el psicólogo).
// =====================================================================
import { conexion } from "../conexion.ts";

type Fila = Record<string, unknown>;

export interface MiembroSala {
  usuarioId: string;
  rol: "Psicologo" | "Paciente";
  nombre: string;
  tieneFoto: boolean;
  fotoVersion: string; // cambio: "versión" de la foto, va en la URL para que siempre salga la foto actual
  principal: boolean; // el paciente que agendó la cita
}

export interface CitaSala {
  citaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  modalidad: string;
  estado: string;
  formato: "Individual" | "Pareja" | "Familiar";
  psicologoUsuarioId: string;
  psicologoNombre: string;
  pacienteUsuarioId: string;
  pacientePerfilId: string;
  pacienteNombre: string;
  miembros: MiembroSala[]; // todas las personas de la cita (psicólogo primero)
}

const FORMATOS = ["Individual", "Pareja", "Familiar"] as const;

export const SalaModel = {
  async cita(citaId: string): Promise<CitaSala | null> {
    const [f] = await conexion.query(
      `SELECT c.CitaId, c.FechaHora, c.DuracionMinutos, c.Modalidad, c.Estado, c.Formato,
              ps.UsuarioId AS PsicologoUsuario, ups.NombreCompleto AS PsicologoNombre,
              (ps.Foto LIKE 'data:image/%') AS PsicologoFoto, CRC32(ps.Foto) AS PsicologoFotoV,
              pp.UsuarioId AS PacienteUsuario, pp.PerfiluId AS PacientePerfil,
              upa.NombreCompleto AS PacienteNombre,
              (pp.Foto LIKE 'data:image/%') AS PacienteFoto, CRC32(pp.Foto) AS PacienteFotoV
       FROM citas c
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios ups ON ups.UsuarioId = ps.UsuarioId
       JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       JOIN usuarios upa ON upa.UsuarioId = pp.UsuarioId
       WHERE c.CitaId = ? LIMIT 1`,
      [citaId],
    ) as Fila[];
    if (!f) return null;

    // Acompañantes (pareja o familiares) con cuenta activa
    const acompanantes = await conexion.query(
      `SELECT pp.UsuarioId, u.NombreCompleto, (pp.Foto LIKE 'data:image/%') AS TieneFoto, CRC32(pp.Foto) AS FotoV
       FROM participantescita pc
       JOIN perfilpaciente pp ON pp.PerfiluId = pc.PacienteId
       JOIN usuarios u ON u.UsuarioId = pp.UsuarioId AND u.EstadoActivo = 1
       WHERE pc.CitaId = ?
       ORDER BY pc.AgregadoEn`,
      [citaId],
    ) as Fila[];

    const formato = FORMATOS.includes(String(f.Formato) as typeof FORMATOS[number])
      ? String(f.Formato) as CitaSala["formato"]
      : "Individual";

    const miembros: MiembroSala[] = [
      {
        usuarioId: String(f.PsicologoUsuario),
        rol: "Psicologo",
        nombre: String(f.PsicologoNombre ?? "Psicólogo"),
        tieneFoto: Number(f.PsicologoFoto ?? 0) === 1,
        fotoVersion: String(f.PsicologoFotoV ?? ""),
        principal: false,
      },
      {
        usuarioId: String(f.PacienteUsuario),
        rol: "Paciente",
        nombre: String(f.PacienteNombre ?? "Paciente"),
        tieneFoto: Number(f.PacienteFoto ?? 0) === 1,
        fotoVersion: String(f.PacienteFotoV ?? ""),
        principal: true,
      },
      ...acompanantes
        .filter((a) => String(a.UsuarioId) !== String(f.PacienteUsuario))
        .map((a) => ({
          usuarioId: String(a.UsuarioId),
          rol: "Paciente" as const,
          nombre: String(a.NombreCompleto ?? "Participante"),
          tieneFoto: Number(a.TieneFoto ?? 0) === 1,
          fotoVersion: String(a.FotoV ?? ""),
          principal: false,
        })),
    ];

    return {
      citaId: String(f.CitaId),
      fechaHora: new Date(f.FechaHora as string),
      duracionMinutos: Number(f.DuracionMinutos ?? 50) || 50,
      modalidad: String(f.Modalidad ?? ""),
      estado: String(f.Estado ?? ""),
      formato,
      psicologoUsuarioId: String(f.PsicologoUsuario),
      psicologoNombre: String(f.PsicologoNombre ?? "Psicólogo"),
      pacienteUsuarioId: String(f.PacienteUsuario),
      pacientePerfilId: String(f.PacientePerfil),
      pacienteNombre: String(f.PacienteNombre ?? "Paciente"),
      miembros,
    };
  },

  // Foto de perfil de una persona de la sala (se valida antes que sea de la cita)
  async foto(usuarioId: string): Promise<unknown> {
    const [f] = await conexion.query(
      `SELECT COALESCE(pp.Foto, ps.Foto) AS Foto
       FROM usuarios u
       LEFT JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       LEFT JOIN perfilpsicologo ps ON ps.UsuarioId = u.UsuarioId
       WHERE u.UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    return f?.Foto ?? null;
  },

  // Al terminar la sesión el psicólogo puede marcar la cita como completada
  async completar(citaId: string): Promise<boolean> {
    const r = await conexion.execute(
      `UPDATE citas SET Estado = 'Completada' WHERE CitaId = ? AND Estado = 'Confirmada'`,
      [citaId],
    );
    return (r.affectedRows ?? 0) > 0;
  },
};
