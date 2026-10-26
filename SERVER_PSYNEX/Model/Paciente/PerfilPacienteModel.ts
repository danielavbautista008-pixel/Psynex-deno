// =====================================================================
// cambio: ARCHIVO NUEVO — Mi perfil del paciente (datos, foto y ajustes)
//   usuarios        -> NombreCompleto, FechaNacimiento, Email
//   perfilpaciente  -> Foto, Telefono, Genero, Ocupacion
//   ajustesusuario  -> Notificaciones (recordatorios por correo)
// La foto se guarda como "data:image/...;base64,..." igual que la del
// psicólogo; así también aparece en el chat.
// =====================================================================
import { conexion } from "../conexion.ts";
import { RegistroModel } from "../RegistroModel.ts";
import type { ActualizarPerfilPacienteInput } from "../../Validators/Paciente/PerfilPacienteValidator.ts";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const PerfilPacienteModel = {
  async obtener(usuarioId: string) {
    // Si por alguna razón no tiene fila en perfilpaciente, se crea vacía
    await RegistroModel.crearPerfilPaciente(usuarioId);
    const [f] = await conexion.query(
      `SELECT u.NombreCompleto, u.Email, DATE_FORMAT(u.FechaNacimiento, '%Y-%m-%d') AS FechaNacimiento,
              pp.Telefono, pp.Genero, pp.Ocupacion,
              (pp.Foto IS NOT NULL AND pp.Foto LIKE 'data:image/%') AS TieneFoto,
              CRC32(pp.Foto) AS FotoVersion,
              (SELECT a.Notificaciones FROM ajustesusuario a WHERE a.UsuarioId = u.UsuarioId LIMIT 1) AS Recordatorios
       FROM usuarios u JOIN perfilpaciente pp ON pp.UsuarioId = u.UsuarioId
       WHERE u.UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (!f) return null;
    return {
      nombre: texto(f.NombreCompleto),
      email: texto(f.Email),
      fechaNacimiento: texto(f.FechaNacimiento),
      telefono: texto(f.Telefono),
      genero: texto(f.Genero),
      ocupacion: texto(f.Ocupacion),
      tieneFoto: Number(f.TieneFoto ?? 0) === 1,
      fotoVersion: texto(f.FotoVersion),
      // Si nunca lo ha cambiado, los recordatorios quedan activos
      recordatorios: f.Recordatorios === null || f.Recordatorios === undefined ? true : Number(f.Recordatorios) === 1,
    };
  },

  async actualizar(usuarioId: string, d: ActualizarPerfilPacienteInput) {
    await RegistroModel.crearPerfilPaciente(usuarioId);
    await conexion.transaction(async (conn) => {
      if (d.fechaNacimiento) {
        await conn.execute(
          `UPDATE usuarios SET NombreCompleto = ?, FechaNacimiento = ? WHERE UsuarioId = ?`,
          [d.nombre, d.fechaNacimiento, usuarioId],
        );
      } else {
        await conn.execute(`UPDATE usuarios SET NombreCompleto = ? WHERE UsuarioId = ?`, [d.nombre, usuarioId]);
      }
      await conn.execute(
        `UPDATE perfilpaciente SET Telefono = ?, Genero = ?, Ocupacion = ? WHERE UsuarioId = ?`,
        [d.telefono ?? "", d.genero ?? "", d.ocupacion ?? "", usuarioId],
      );
    });
  },

  async foto(usuarioId: string) {
    const [f] = await conexion.query(
      `SELECT Foto FROM perfilpaciente WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    return f?.Foto ?? null;
  },

  async guardarFoto(usuarioId: string, foto: string | null) {
    await RegistroModel.crearPerfilPaciente(usuarioId);
    await conexion.execute(`UPDATE perfilpaciente SET Foto = ? WHERE UsuarioId = ?`, [foto, usuarioId]);
  },

  async guardarAjustes(usuarioId: string, recordatorios: boolean) {
    const [a] = await conexion.query(
      `SELECT AjusteId FROM ajustesusuario WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Fila[];
    if (a) {
      await conexion.execute(
        `UPDATE ajustesusuario SET Notificaciones = ?, ActualizadoEn = NOW() WHERE AjusteId = ?`,
        [recordatorios ? 1 : 0, a.AjusteId],
      );
    } else {
      await conexion.execute(
        `INSERT INTO ajustesusuario (AjusteId, UsuarioId, Idioma, TemaOscuro, Notificaciones, ActualizadoEn, ColorPreferido)
         VALUES (?, ?, 'es', 0, ?, NOW(), NULL)`,
        [crypto.randomUUID(), usuarioId, recordatorios ? 1 : 0],
      );
    }
  },
};
