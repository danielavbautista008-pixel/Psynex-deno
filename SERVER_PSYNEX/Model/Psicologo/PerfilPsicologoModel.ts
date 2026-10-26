import { conexion } from "../conexion.ts";
import type {
  ActualizarPerfilInput,
  EstudioInput,
  ExperienciaInput,
} from "../../Validators/Psicologo/PerfilPsicologoValidator.ts";

type Fila = Record<string, unknown>;

// "Ana María Ruiz" -> "Ana" (en las reseñas solo se muestra el primer nombre)
const primerNombre = (nombre: unknown) => String(nombre ?? "Paciente").trim().split(/\s+/)[0] || "Paciente";

// "2024-03" -> "2024-03-01" (las columnas son datetime)
const inicioDeMes = (mes: string | null | undefined) => (mes ? `${mes}-01` : null);

export const PerfilPsicologoModel = {

  // Perfil completo del psicólogo que inició sesión
  async obtener(perfilId: string) {
    const [perfil] = await conexion.query(
      `SELECT p.PerfilId, p.UsuarioId, u.NombreCompleto, u.Email, u.FechaNacimiento,
              p.Biografia, p.Modalidad, p.TipoServicio, p.PrecioPorHora, p.Direccion,
              p.Telefono, p.EstaVerificado, p.ServicioVoluntario, p.CreadoEn,
              (p.Foto IS NOT NULL AND p.Foto LIKE 'data:image/%') AS TieneFoto,
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

    // Reseñas que le dejaron sus pacientes (promedio, cuántas por estrella y las últimas)
    const [prom] = await conexion.query(
      `SELECT ROUND(AVG(cc.Puntaje), 1) AS promedio, COUNT(*) AS total
       FROM calificacionescita cc JOIN citas c ON c.CitaId = cc.CitaId
       WHERE c.PsicologoId = ?`,
      [perfilId],
    );
    const porEstrella = await conexion.query(
      `SELECT cc.Puntaje AS estrellas, COUNT(*) AS cantidad
       FROM calificacionescita cc JOIN citas c ON c.CitaId = cc.CitaId
       WHERE c.PsicologoId = ?
       GROUP BY cc.Puntaje`,
      [perfilId],
    ) as Fila[];
    const comentarios = (await conexion.query(
      `SELECT cc.Puntaje, cc.Comentario, cc.CreadoEn, u.NombreCompleto
       FROM calificacionescita cc
       JOIN citas c ON c.CitaId = cc.CitaId
       LEFT JOIN perfilpaciente pp ON pp.PerfiluId = cc.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE c.PsicologoId = ? AND cc.Comentario IS NOT NULL AND TRIM(cc.Comentario) <> ''
       ORDER BY cc.CreadoEn DESC
       LIMIT 20`,
      [perfilId],
    ) as Fila[]).map((r) => ({
      nombre: primerNombre(r.NombreCompleto),
      puntaje: Number(r.Puntaje),
      comentario: String(r.Comentario),
      fecha: r.CreadoEn,
    }));

    const resenas = {
      promedio: prom?.promedio === null || prom?.promedio === undefined ? null : Number(prom.promedio),
      total: Number(prom?.total ?? 0),
      porEstrella: [5, 4, 3, 2, 1].map((n) => ({
        estrellas: n,
        cantidad: Number(porEstrella.find((f) => Number(f.estrellas) === n)?.cantidad ?? 0),
      })),
      comentarios,
    };

    return { ...perfil, especialidades, estudios, experiencia, resenas };
  },

  // ------------------------------ Foto ------------------------------

  async foto(perfilId: string) {
    const [fila] = await conexion.query(
      `SELECT Foto FROM perfilpsicologo WHERE PerfilId = ? LIMIT 1`,
      [perfilId],
    );
    return fila?.Foto ?? null;
  },

  async guardarFoto(perfilId: string, foto: string) {
    await conexion.execute(`UPDATE perfilpsicologo SET Foto = ? WHERE PerfilId = ?`, [foto, perfilId]);
  },

  // ---------------------------- Estudios ----------------------------

  async crearEstudio(perfilId: string, d: EstudioInput) {
    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO estudios (EstudioId, PerfilId, Universidad, Titulo, NivelEstudio, FechaGrado, EnCurso, CreadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, perfilId, d.universidad, d.titulo, d.nivelEstudio,
       d.enCurso || !d.anioGrado ? null : `${d.anioGrado}-01-01`, d.enCurso ? 1 : 0],
    );
    return id;
  },

  // Devuelve false si el estudio no es de este psicólogo
  async actualizarEstudio(perfilId: string, estudioId: string, d: EstudioInput) {
    const r = await conexion.execute(
      `UPDATE estudios SET Universidad = ?, Titulo = ?, NivelEstudio = ?, FechaGrado = ?, EnCurso = ?
       WHERE EstudioId = ? AND PerfilId = ?`,
      [d.universidad, d.titulo, d.nivelEstudio,
       d.enCurso || !d.anioGrado ? null : `${d.anioGrado}-01-01`, d.enCurso ? 1 : 0,
       estudioId, perfilId],
    );
    return Number(r.affectedRows ?? 0) > 0 || await this.existe("estudios", "EstudioId", "PerfilId", estudioId, perfilId);
  },

  async eliminarEstudio(perfilId: string, estudioId: string) {
    const r = await conexion.execute(
      `DELETE FROM estudios WHERE EstudioId = ? AND PerfilId = ?`,
      [estudioId, perfilId],
    );
    return Number(r.affectedRows ?? 0) > 0;
  },

  // --------------------------- Experiencia ---------------------------

  async crearExperiencia(perfilId: string, d: ExperienciaInput) {
    const id = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO experiencia (ExperienciaId, PerfileId, Empresa, Cargo, Descripcion, FechaInicio, FechaFin, TrabajaAqui, CreadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, perfilId, d.empresa, d.cargo, d.descripcion ?? "", inicioDeMes(d.fechaInicio),
       d.trabajaAqui ? null : inicioDeMes(d.fechaFin), d.trabajaAqui ? 1 : 0],
    );
    return id;
  },

  async actualizarExperiencia(perfilId: string, experienciaId: string, d: ExperienciaInput) {
    const r = await conexion.execute(
      `UPDATE experiencia SET Empresa = ?, Cargo = ?, Descripcion = ?, FechaInicio = ?, FechaFin = ?, TrabajaAqui = ?
       WHERE ExperienciaId = ? AND PerfileId = ?`,
      [d.empresa, d.cargo, d.descripcion ?? "", inicioDeMes(d.fechaInicio),
       d.trabajaAqui ? null : inicioDeMes(d.fechaFin), d.trabajaAqui ? 1 : 0,
       experienciaId, perfilId],
    );
    return Number(r.affectedRows ?? 0) > 0 ||
      await this.existe("experiencia", "ExperienciaId", "PerfileId", experienciaId, perfilId);
  },

  async eliminarExperiencia(perfilId: string, experienciaId: string) {
    const r = await conexion.execute(
      `DELETE FROM experiencia WHERE ExperienciaId = ? AND PerfileId = ?`,
      [experienciaId, perfilId],
    );
    return Number(r.affectedRows ?? 0) > 0;
  },

  // Si el UPDATE no cambió filas puede ser porque los datos eran iguales:
  // revisamos que el registro sí exista y sea de este psicólogo.
  // (tabla y columnas las pone el código, nunca el usuario)
  async existe(tabla: string, colId: string, colPerfil: string, id: string, perfilId: string) {
    const [fila] = await conexion.query(
      `SELECT 1 AS ok FROM ${tabla} WHERE ${colId} = ? AND ${colPerfil} = ? LIMIT 1`,
      [id, perfilId],
    );
    return Boolean(fila);
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
