import { conexion } from "../conexion.ts";
import type { ListarOfertasQuery, PostularInput } from "../../Validators/Psicologo/OfertasPsicologoValidator.ts";

const SELECT_OFERTA = `
  SELECT o.OfertaId, o.Titulo, o.Descripcion, o.Requisitos, o.Salario, o.Modalidad,
         o.Estado, o.FechaPublicacion,
         pe.NombreEmpresa, pe.Sector, pe.Direccion AS Ubicacion, pe.SitioWeb,
         EXISTS (SELECT 1 FROM postulaciones po
                  WHERE po.OfertaId = o.OfertaId AND po.UsuarioId = ?) AS YaPostulado
  FROM ofertaslaborales o
  JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
`;

export const OfertasPsicologoModel = {

  // Ofertas activas de empresas verificadas
  async listar(usuarioId: string, f: ListarOfertasQuery) {
    const condiciones = ["o.Estado = 'Activa'", "pe.EstaVerificada = 1"];
    const params: (string | number)[] = [];
    if (f.modalidad !== "todas") {
      condiciones.push("o.Modalidad = ?");
      params.push(f.modalidad);
    }
    if (f.busqueda) {
      condiciones.push("(o.Titulo LIKE ? OR o.Descripcion LIKE ? OR pe.NombreEmpresa LIKE ?)");
      const like = `%${f.busqueda}%`;
      params.push(like, like, like);
    }
    const where = `WHERE ${condiciones.join(" AND ")}`;

    const [cuenta] = await conexion.query(
      `SELECT COUNT(*) AS total
       FROM ofertaslaborales o JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       ${where}`,
      params,
    );
    const ofertas = await conexion.query(
      `${SELECT_OFERTA} ${where}
       ORDER BY o.FechaPublicacion DESC
       LIMIT ? OFFSET ?`,
      [usuarioId, ...params, f.porPagina, (f.pagina - 1) * f.porPagina],
    );
    return { ofertas, total: Number(cuenta?.total ?? 0) };
  },

  async buscarPorId(usuarioId: string, ofertaId: string) {
    const [oferta] = await conexion.query(
      `${SELECT_OFERTA} WHERE o.OfertaId = ? LIMIT 1`,
      [usuarioId, ofertaId],
    );
    return oferta ?? null;
  },

  // Crea la postulación y le avisa a la empresa con una notificación.
  async postular(
    usuarioId: string,
    nombrePsicologo: string,
    ofertaId: string,
    d: PostularInput,
    hojaVida: { ruta: string; nombre: string; bytes: number } | null = null,
  ) {
    const [oferta] = await conexion.query(
      `SELECT o.OfertaId, o.Titulo, o.Estado, pe.UsuarioId AS EmpresaUsuarioId
       FROM ofertaslaborales o JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       WHERE o.OfertaId = ? LIMIT 1`,
      [ofertaId],
    );
    if (!oferta) return { error: "Oferta no encontrada", status: 404 };
    if (oferta.Estado !== "Activa") return { error: "Esta oferta ya está cerrada", status: 409 };

    const ya = await conexion.query(
      `SELECT 1 FROM postulaciones WHERE OfertaId = ? AND UsuarioId = ? LIMIT 1`,
      [ofertaId, usuarioId],
    );
    if (ya.length) return { error: "Ya te postulaste a esta oferta", status: 409 };

    const postulacionId = crypto.randomUUID();
    await conexion.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO postulaciones
           (PostulacionId, OfertaId, UsuarioId, CartaPresent, Estado, FechaPostulacion,
            Telefono, Ciudad, Especialidad, ExperienciaAnos, PerfilProfesional)
         VALUES (?, ?, ?, ?, 'Pendiente', NOW(), ?, ?, ?, ?, ?)`,
        [
          postulacionId, ofertaId, usuarioId, d.cartaPresentacion,
          d.telefono, d.ciudad, d.especialidad, d.experienciaAnos, d.perfilProfesional,
        ],
      );
      // La hoja de vida se guarda en documentos (tipo "hoja_vida") del usuario
      if (hojaVida) {
        await conn.execute(
          `INSERT INTO documentos
             (DocumentoArchivoId, UsuarioId, Tipo, NombreOriginal, RutaArchivo, Mime, TamanoBytes, CreadoEn)
           VALUES (?, ?, 'hoja_vida', ?, ?, 'application/pdf', ?, NOW())`,
          [crypto.randomUUID(), usuarioId, hojaVida.nombre, hojaVida.ruta, hojaVida.bytes],
        );
      }
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Nueva postulación', ?, 0, NOW())`,
        [crypto.randomUUID(), oferta.EmpresaUsuarioId, `${nombrePsicologo} se postuló a "${oferta.Titulo}".`],
      );
    });
    return { postulacionId };
  },

  async misPostulaciones(usuarioId: string) {
    return await conexion.query(
      `SELECT po.PostulacionId, po.Estado, po.FechaPostulacion,
              o.OfertaId, o.Titulo, o.Modalidad, o.Salario, o.Estado AS EstadoOferta,
              pe.NombreEmpresa
       FROM postulaciones po
       JOIN ofertaslaborales o ON o.OfertaId = po.OfertaId
       JOIN perfilempresa pe ON pe.PerfileId = o.PerfileId
       WHERE po.UsuarioId = ?
       ORDER BY po.FechaPostulacion DESC`,
      [usuarioId],
    );
  },
};
