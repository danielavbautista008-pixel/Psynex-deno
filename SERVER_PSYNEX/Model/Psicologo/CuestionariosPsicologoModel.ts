import { conexion } from "../conexion.ts";
import type {
  AsignarCuestionarioInput,
  ListarAsignacionesQuery,
} from "../../Validators/Psicologo/CuestionariosPsicologoValidator.ts";

// NOTA: en cuestionarioasignado, PsicologoId guarda el UsuarioId del psicólogo
// (así estaban los datos existentes) y PacienteId guarda el PerfiluId del paciente.

export const CuestionariosPsicologoModel = {

  // Catálogo de cuestionarios activos, con su categoría
  async catalogo() {
    const cuestionarios = await conexion.query(
      `SELECT c.CuestionarioId, c.NombreCuestionario, c.Descripcion, c.NumeroPreguntas,
              c.PuntajeMaximo, cat.CategoriaId, cat.Nombre AS CategoriaNombre
       FROM cuestionarios c
       LEFT JOIN categoriasclinicas cat ON cat.CategoriaId = c.CategoriaId
       WHERE c.EstadoActivo = 1
       ORDER BY cat.Nombre, c.NombreCuestionario`,
    );
    const categorias = await conexion.query(
      `SELECT cat.CategoriaId, cat.Nombre, COUNT(c.CuestionarioId) AS Cantidad
       FROM categoriasclinicas cat
       LEFT JOIN cuestionarios c ON c.CategoriaId = cat.CategoriaId AND c.EstadoActivo = 1
       GROUP BY cat.CategoriaId, cat.Nombre
       ORDER BY cat.Nombre`,
    );
    return { cuestionarios, categorias };
  },

  async listarAsignaciones(usuarioPsicologoId: string, filtros: ListarAsignacionesQuery) {
    const condiciones = ["a.PsicologoId = ?"];
    const params: string[] = [usuarioPsicologoId];
    if (filtros.estado !== "todos") {
      condiciones.push("a.Estado = ?");
      params.push(filtros.estado);
    }
    if (filtros.pacienteId) {
      condiciones.push("a.PacienteId = ?");
      params.push(filtros.pacienteId);
    }
    return await conexion.query(
      `SELECT a.AsignacionId, a.Estado, a.FechaAsignacion, a.FechaLimite, a.Nota,
              a.PacienteId,
              CASE WHEN pp.EsAnonimo = 1 THEN 'Paciente anónimo'
                   ELSE COALESCE(u.NombreCompleto, 'Paciente') END AS PacienteNombre,
              c.CuestionarioId, c.NombreCuestionario
       FROM cuestionarioasignado a
       JOIN cuestionarios c ON c.CuestionarioId = a.CuestionarioId
       LEFT JOIN perfilpaciente pp ON pp.PerfiluId = a.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = COALESCE(pp.UsuarioId, a.PacienteId)
       WHERE ${condiciones.join(" AND ")}
       ORDER BY a.FechaAsignacion DESC`,
      params,
    );
  },

  // Crea la asignación y le avisa al paciente con una notificación.
  // Devuelve un texto de error si no se puede asignar, o el id si todo salió bien.
  async asignar(usuarioPsicologoId: string, nombrePsicologo: string, data: AsignarCuestionarioInput) {
    const [cuestionario] = await conexion.query(
      `SELECT NombreCuestionario FROM cuestionarios
       WHERE CuestionarioId = ? AND EstadoActivo = 1 LIMIT 1`,
      [data.cuestionarioId],
    );
    if (!cuestionario) return { error: "El cuestionario no existe o está inactivo" };

    const repetida = await conexion.query(
      `SELECT 1 FROM cuestionarioasignado
       WHERE PsicologoId = ? AND PacienteId = ? AND CuestionarioId = ? AND Estado = 'Pendiente'
       LIMIT 1`,
      [usuarioPsicologoId, data.pacienteId, data.cuestionarioId],
    );
    if (repetida.length) return { error: "El paciente ya tiene este cuestionario pendiente" };

    const asignacionId = crypto.randomUUID();
    await conexion.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO cuestionarioasignado
           (AsignacionId, PsicologoId, PacienteId, CuestionarioId, FechaAsignacion, Estado, FechaLimite, Nota)
         VALUES (?, ?, ?, ?, NOW(), 'Pendiente', ?, ?)`,
        [
          asignacionId,
          usuarioPsicologoId,
          data.pacienteId,
          data.cuestionarioId,
          data.fechaLimite ?? null,
          data.nota ?? null,
        ],
      );

      // Notificación para el paciente (su UsuarioId sale del perfil)
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         SELECT ?, pp.UsuarioId, 'Sistema', 'Nuevo cuestionario asignado', ?, 0, NOW()
         FROM perfilpaciente pp
         WHERE pp.PerfiluId = ? AND pp.UsuarioId IN (SELECT UsuarioId FROM usuarios)`,
        [
          crypto.randomUUID(),
          `${nombrePsicologo} te asignó "${cuestionario.NombreCuestionario}".`,
          data.pacienteId,
        ],
      );
    });
    return { asignacionId };
  },

  // Solo se pueden cancelar asignaciones que el paciente aún no ha respondido
  async cancelar(usuarioPsicologoId: string, asignacionId: string) {
    const r = await conexion.execute(
      `DELETE FROM cuestionarioasignado
       WHERE AsignacionId = ? AND PsicologoId = ? AND Estado = 'Pendiente'`,
      [asignacionId, usuarioPsicologoId],
    );
    return (r.affectedRows ?? 0) > 0;
  },
};
