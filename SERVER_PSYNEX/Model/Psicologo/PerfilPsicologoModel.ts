import { conexion } from "../conexion.ts";
import type { ActualizarPerfilInput } from "../../Validators/Psicologo/PerfilPsicologoValidator.ts";

export const PerfilPsicologoModel = {

  // Perfil completo del psicólogo que inició sesión
  async obtener(perfilId: string) {
    const [perfil] = await conexion.query(
      `SELECT p.PerfilId, p.UsuarioId, u.NombreCompleto, u.Email, u.FechaNacimiento,
              p.Biografia, p.Modalidad, p.TipoServicio, p.PrecioPorHora, p.Direccion,
              p.Telefono, p.EstaVerificado, p.ServicioVoluntario, p.CreadoEn,
              (SELECT d.EstadoVerificacion FROM documentosverificacion d
                WHERE d.PerfilId = p.PerfilId ORDER BY d.CreadoEn DESC LIMIT 1) AS EstadoVerificacion
       FROM perfilpsicologo p
       JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       WHERE p.PerfilId = ?
       LIMIT 1`,
      [perfilId],
    );
    if (!perfil) return null;

    const especialidades = await conexion.query(
      `SELECT e.EspecialidadId, e.NombreEspecialidad, e.Categoria, e.Color
       FROM psicologoespecialidad pe
       JOIN especialidades e ON e.EspecialidadId = pe.EspecialidadId
       WHERE pe.PerfilId = ?
       ORDER BY e.NombreEspecialidad`,
      [perfilId],
    );
    const estudios = await conexion.query(
      `SELECT EstudioId, Universidad, Titulo, NivelEstudio, FechaGrado, EnCurso
       FROM estudios WHERE PerfilId = ? ORDER BY COALESCE(FechaGrado, CreadoEn) DESC`,
      [perfilId],
    );
    const experiencia = await conexion.query(
      `SELECT ExperienciaId, Empresa, Cargo, Descripcion, FechaInicio, FechaFin, TrabajaAqui
       FROM experiencia WHERE PerfileId = ? ORDER BY FechaInicio DESC`,
      [perfilId],
    );

    return { ...perfil, especialidades, estudios, experiencia };
  },

  // Catálogo de especialidades activas (para el selector)
  async catalogoEspecialidades() {
    return await conexion.query(
      `SELECT EspecialidadId, NombreEspecialidad, Categoria, Color
       FROM especialidades WHERE EstaActiva = 1
       ORDER BY Categoria, NombreEspecialidad`,
    );
  },

  async actualizar(perfilId: string, data: ActualizarPerfilInput) {
    const mapa: Record<string, string> = {
      biografia: "Biografia",
      modalidad: "Modalidad",
      tipoServicio: "TipoServicio",
      precioPorHora: "PrecioPorHora",
      direccion: "Direccion",
      telefono: "Telefono",
    };
    const campos: string[] = [];
    const valores: unknown[] = [];

    for (const [clave, columna] of Object.entries(mapa)) {
      const valor = data[clave as keyof ActualizarPerfilInput];
      if (valor !== undefined) {
        campos.push(`${columna} = ?`);
        valores.push(valor);
      }
    }
    if (data.servicioVoluntario !== undefined) {
      campos.push("ServicioVoluntario = ?");
      valores.push(data.servicioVoluntario ? 1 : 0);
    }
    if (!campos.length) return;

    await conexion.execute(
      `UPDATE perfilpsicologo SET ${campos.join(", ")} WHERE PerfilId = ?`,
      [...valores, perfilId],
    );
  },

  // Reemplaza todas las especialidades del psicólogo en una transacción.
  // Devuelve false si alguna especialidad no existe o está inactiva.
  async reemplazarEspecialidades(perfilId: string, especialidadIds: string[]) {
    const unicas = [...new Set(especialidadIds)];

    if (unicas.length) {
      const marcas = unicas.map(() => "?").join(", ");
      const [cuenta] = await conexion.query(
        `SELECT COUNT(*) AS n FROM especialidades
         WHERE EstaActiva = 1 AND EspecialidadId IN (${marcas})`,
        unicas,
      );
      if (Number(cuenta?.n ?? 0) !== unicas.length) return false;
    }

    await conexion.transaction(async (conn) => {
      await conn.execute(`DELETE FROM psicologoespecialidad WHERE PerfilId = ?`, [perfilId]);
      for (const id of unicas) {
        await conn.execute(
          `INSERT INTO psicologoespecialidad (PsicologoEspecialidadId, PerfilId, EspecialidadId, CreadoEn)
           VALUES (?, ?, ?, NOW())`,
          [crypto.randomUUID(), perfilId, id],
        );
      }
    });
    return true;
  },
};
