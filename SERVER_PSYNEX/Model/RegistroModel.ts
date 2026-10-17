import { conexion } from "./conexion.ts";

export interface DocumentoGuardado {
  tipo: string;
  nombreOriginal: string;
  ruta: string;
  mime: string;
  bytes: number;
}

// Registro de un psicólogo: crea en UNA transacción el usuario, su perfil,
// su registro de verificación (Pendiente) y la lista de documentos subidos.
// Si algo falla, no queda nada a medias en la base de datos.
export const RegistroModel = {
  async crearPsicologo(datos: {
    usuarioId: string;
    nombreCompleto: string;
    email: string;
    passwordHash: string;
    fechaNacimiento: string;
    numeroDocumento: string;
    documentos: DocumentoGuardado[];
  }): Promise<string> {
    const perfilId = crypto.randomUUID();

    await conexion.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO usuarios
           (UsuarioId, NombreCompleto, FechaNacimiento, Rol, Email, PasswordHash, EstadoActivo, CreadoEn)
         VALUES (?, ?, ?, 'Psicologo', ?, ?, 1, NOW())`,
        [datos.usuarioId, datos.nombreCompleto, datos.fechaNacimiento, datos.email, datos.passwordHash],
      );

      // El perfil arranca vacío y SIN verificar: el psicólogo lo completa
      // después (PATCH /api/psicologo/perfil) y el admin lo verifica.
      await conn.execute(
        `INSERT INTO perfilpsicologo
           (PerfilId, UsuarioId, Biografia, Modalidad, TipoServicio, PrecioPorHora,
            Direccion, Telefono, EstaVerificado, CreadoEn)
         VALUES (?, ?, '', 'Virtual', 'Pago', 0, '', '', 0, NOW())`,
        [perfilId, datos.usuarioId],
      );

      await conn.execute(
        `INSERT INTO documentosverificacion
           (DocumentoId, PerfilId, Cedula, NivelTitulo, EstadoVerificacion, FechaVerificacion, CreadoEn)
         VALUES (?, ?, ?, '', 'Pendiente', NULL, NOW())`,
        [crypto.randomUUID(), perfilId, datos.numeroDocumento],
      );

      for (const doc of datos.documentos) {
        await conn.execute(
          `INSERT INTO documentos
             (DocumentoArchivoId, UsuarioId, Tipo, NombreOriginal, RutaArchivo, Mime, TamanoBytes, CreadoEn)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), datos.usuarioId, doc.tipo, doc.nombreOriginal, doc.ruta, doc.mime, doc.bytes],
        );
      }
    });

    return perfilId;
  },

  // Registro de una empresa: en UNA transacción crea el usuario (rol Empresa),
  // su perfilempresa SIN verificar (EstaVerificada = 0, así le aparece al
  // admin en "Verificar empresas") y los documentos subidos (RUT, Cámara...).
  async crearEmpresa(datos: {
    usuarioId: string;
    nombreEmpresa: string;
    nit: string;
    email: string;
    telefono: string;
    sector: string;
    cantidadEmpleados: number | null;
    passwordHash: string;
    documentos: DocumentoGuardado[];
  }): Promise<string> {
    const perfilId = crypto.randomUUID();

    await conexion.transaction(async (conn) => {
      // usuarios.FechaNacimiento es obligatoria: para una empresa se guarda
      // la fecha del registro (no se usa para nada más).
      await conn.execute(
        `INSERT INTO usuarios
           (UsuarioId, NombreCompleto, FechaNacimiento, Rol, Email, PasswordHash, EstadoActivo, CreadoEn)
         VALUES (?, ?, CURDATE(), 'Empresa', ?, ?, 1, NOW())`,
        [datos.usuarioId, datos.nombreEmpresa, datos.email, datos.passwordHash],
      );

      // Dirección, sitio web, logo y descripción los completa después la empresa
      await conn.execute(
        `INSERT INTO perfilempresa
           (PerfileId, UsuarioId, NombreEmpresa, Nit, Sector, CantidadEmpleados, Telefono,
            Direccion, SitioWeb, Logo, Descripcion, EstaVerificada, CreadoEn)
         VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '', '', 0, NOW())`,
        [
          perfilId, datos.usuarioId, datos.nombreEmpresa, datos.nit, datos.sector,
          datos.cantidadEmpleados, datos.telefono,
        ],
      );

      for (const doc of datos.documentos) {
        await conn.execute(
          `INSERT INTO documentos
             (DocumentoArchivoId, UsuarioId, Tipo, NombreOriginal, RutaArchivo, Mime, TamanoBytes, CreadoEn)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), datos.usuarioId, doc.tipo, doc.nombreOriginal, doc.ruta, doc.mime, doc.bytes],
        );
      }
    });

    return perfilId;
  },

  // Perfil vacío de paciente. Sin esta fila el paciente no puede agendar
  // citas ni guardar resultados (todo eso usa perfilpaciente.PerfiluId).
  // Teléfono, género y ocupación los completa después en su perfil.
  async crearPerfilPaciente(usuarioId: string): Promise<string> {
    const existente = await conexion.query(
      `SELECT PerfiluId FROM perfilpaciente WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    ) as Record<string, unknown>[];
    if (existente.length) return String(existente[0].PerfiluId);

    const perfilId = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO perfilpaciente (PerfiluId, UsuarioId, Foto, Telefono, Genero, Ocupacion, EsAnonimo, CreadoEn)
       VALUES (?, ?, NULL, '', '', '', 0, NOW())`,
      [perfilId, usuarioId],
    );
    return perfilId;
  },
};
