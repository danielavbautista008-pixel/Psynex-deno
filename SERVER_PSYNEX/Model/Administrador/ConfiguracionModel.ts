import { conexion } from "../conexion.ts";

export const ConfiguracionModel = {

  async listar() {
    return await conexion.query(
      `SELECT Clave, Valor, Descripcion, ActualizadoEn FROM configuracionplataforma ORDER BY Clave`,
    );
  },

  // Solo afecta los pagos NUEVOS: cada pago guarda su propio PorcentajeComision
  async actualizarComision(porcentaje: number) {
    await conexion.execute(
      `INSERT INTO configuracionplataforma (ConfigId, Clave, Valor, Descripcion, ActualizadoEn)
       VALUES (UUID(), 'ComisionPorcentaje', ?,
               'Porcentaje que Psynex retiene de cada cita pagada. Solo afecta pagos nuevos.', NOW())
       ON DUPLICATE KEY UPDATE Valor = VALUES(Valor), ActualizadoEn = NOW()`,
      [String(porcentaje)],
    );
  },

  // ---------------------- Recompensas (citas gratis) ----------------------

  async listarRecompensas() {
    return await conexion.query(
      `SELECT r.PeriodoId, r.Anio, r.Mes, r.CupoCitas, r.CitasOtorgadas, r.ValorPorCita,
              r.CupoCitas - r.CitasOtorgadas AS Disponibles,
              u.NombreCompleto AS CreadoPor, r.CreadoEn
       FROM recompensasperiodo r
       LEFT JOIN usuarios u ON u.UsuarioId = r.CreadoPorId
       ORDER BY r.Anio DESC, r.Mes DESC`,
    );
  },

  // Crea o actualiza el tope de un mes. No deja bajar el cupo por debajo
  // de las citas que ya se otorgaron ese mes.
  async guardarRecompensa(anio: number, mes: number, cupo: number, valor: number, adminId: string) {
    const [actual] = await conexion.query(
      `SELECT CitasOtorgadas FROM recompensasperiodo WHERE Anio = ? AND Mes = ? LIMIT 1`,
      [anio, mes],
    );
    if (actual && cupo < Number(actual.CitasOtorgadas)) {
      return { error: `Ya se otorgaron ${actual.CitasOtorgadas} citas este mes; el cupo no puede ser menor` };
    }
    await conexion.execute(
      `INSERT INTO recompensasperiodo (PeriodoId, Anio, Mes, CupoCitas, CitasOtorgadas, ValorPorCita, CreadoPorId, CreadoEn)
       VALUES (?, ?, ?, ?, 0, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE CupoCitas = VALUES(CupoCitas), ValorPorCita = VALUES(ValorPorCita)`,
      [crypto.randomUUID(), anio, mes, cupo, valor, adminId],
    );
    return { ok: true };
  },

  // ------------------------------ Reclamos ------------------------------

  async listarReclamos(estado: string) {
    const where = estado !== "todos" ? "WHERE r.Estado = ?" : "";
    return await conexion.query(
      `SELECT r.ReclamoId, r.PagoId, r.Motivo, r.Descripcion, r.Estado, r.Respuesta,
              r.CreadoEn, r.RespondidoEn,
              u.NombreCompleto AS PsicologoNombre, u.Email AS PsicologoEmail,
              p.MontoNeto, p.EstadoTransferencia
       FROM reclamospago r
       JOIN perfilpsicologo ps ON ps.PerfilId = r.PerfilId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       LEFT JOIN pagos p ON p.PagoId = r.PagoId
       ${where}
       ORDER BY FIELD(r.Estado, 'Abierto', 'EnRevision', 'Resuelto', 'Rechazado'), r.CreadoEn DESC`,
      estado !== "todos" ? [estado] : [],
    );
  },

  // Responde el reclamo y le avisa al psicólogo con una notificación
  async responderReclamo(reclamoId: string, estado: string, respuesta: string | undefined, adminId: string) {
    return await conexion.transaction(async (conn) => {
      const [reclamo] = (await conn.query(
        `SELECT r.ReclamoId, r.Motivo, ps.UsuarioId
         FROM reclamospago r JOIN perfilpsicologo ps ON ps.PerfilId = r.PerfilId
         WHERE r.ReclamoId = ? LIMIT 1`,
        [reclamoId],
      )) as Record<string, unknown>[];
      if (!reclamo) return false;

      await conn.execute(
        `UPDATE reclamospago
         SET Estado = ?, Respuesta = COALESCE(?, Respuesta), RespondidoPorId = ?,
             RespondidoEn = NOW()
         WHERE ReclamoId = ?`,
        [estado, respuesta ?? null, adminId, reclamoId],
      );
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Tu reclamo fue actualizado', ?, 0, NOW())`,
        [crypto.randomUUID(), reclamo.UsuarioId, `Reclamo "${reclamo.Motivo}": ${estado}.`],
      );
      return true;
    });
  },
};
