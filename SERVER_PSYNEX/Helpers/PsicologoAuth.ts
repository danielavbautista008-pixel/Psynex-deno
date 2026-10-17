import { conexion } from "../Model/conexion.ts";

export async function obtenerPerfilPsicologo(usuarioId: string) {
  const rows = await conexion.query(
    `SELECT p.PerfilId, p.UsuarioId, p.Telefono, p.EstaVerificado,
            u.NombreCompleto, u.Email, u.EstadoActivo
     FROM perfilpsicologo p
     INNER JOIN usuarios u ON u.UsuarioId = p.UsuarioId
     WHERE p.UsuarioId = ? AND u.Rol = 'Psicologo'
     LIMIT 1`,
    [usuarioId],
  );
  return rows[0] ?? null;
}

// ¿Este paciente tiene (o tuvo) alguna cita con este psicólogo?
// Es la regla de acceso a datos clínicos (RNF-09): un psicólogo solo ve
// la información de SUS pacientes. pacienteId es el PerfiluId del paciente.
export async function esPacienteDelPsicologo(perfilId: string, pacienteId: string) {
  const rows = await conexion.query(
    `SELECT 1 FROM citas WHERE PsicologoId = ? AND PacienteId = ? LIMIT 1`,
    [perfilId, pacienteId],
  );
  return rows.length > 0;
}
