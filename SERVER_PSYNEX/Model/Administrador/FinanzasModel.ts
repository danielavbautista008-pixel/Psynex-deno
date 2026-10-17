import { conexion } from "../conexion.ts";

export const FinanzasModel = {
  async resumen() {
    const sql = `
      SELECT
        COUNT(*) AS totalPagos,
        COALESCE(SUM(MontoTotal), 0) AS montoTotal,
        COALESCE(SUM(ComisionPsynex), 0) AS comisionTotal,
        COALESCE(SUM(MontoNeto), 0) AS montoNeto,
        SUM(CASE WHEN EstadoPago = 'Completado' THEN 1 ELSE 0 END) AS completados,
        SUM(CASE WHEN EstadoPago = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN EsGratuita = 1 THEN 1 ELSE 0 END) AS gratuitos
      FROM pagos
    `;
    const row = (await conexion.query(sql))[0] ?? {};
    return {
      totalPagos: Number(row.totalPagos ?? 0),
      montoTotal: Number(row.montoTotal ?? 0),
      comisionTotal: Number(row.comisionTotal ?? 0),
      montoNeto: Number(row.montoNeto ?? 0),
      completados: Number(row.completados ?? 0),
      pendientes: Number(row.pendientes ?? 0),
      gratuitos: Number(row.gratuitos ?? 0),
    };
  },

  async listar(pagina = 1, porPagina = 20) {
    const offset = (pagina - 1) * porPagina;

    const count = await conexion.query(`SELECT COUNT(*) AS total FROM pagos`);
    const total = Number(count[0]?.total ?? 0);

    const datos = await conexion.query(
      `
      SELECT
        p.PagoId,
        p.CitaId,
        p.MontoTotal,
        p.MontoAnticipo,
        p.MontoPendiente,
        p.ComisionPsynex,
        p.MontoNeto,
        p.EsGratuita,
        p.EstadoPago,
        p.EstadoTransferencia,
        p.Origen,
        p.PorcentajeComision,
        p.FechaTransferencia,
        p.FechaPago,
        p.CreadoEn,
        m.Nombre AS MetodoPago,
        c.FechaHora AS CitaFecha,
        c.Estado AS CitaEstado
      FROM pagos p
      LEFT JOIN metodospago m ON m.MetodoPagoId = p.MetodoPagoId
      LEFT JOIN citas c ON c.CitaId = p.CitaId
      ORDER BY p.CreadoEn DESC
      LIMIT ? OFFSET ?
      `,
      [porPagina, offset],
    );

    return { datos, total, pagina, porPagina };
  },

  // Todo lo que muestra la vista Finanzas del admin, del MES ACTUAL.
  // Solo cuenta pagos con EstadoPago = 'Completado'.
  async panel() {
    const INICIO_MES = "DATE_FORMAT(NOW(), '%Y-%m-01')";
    const INICIO_MES_ANTERIOR = "DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01')";

    const [totales] = await conexion.query(
      `SELECT
         COALESCE(SUM(CASE WHEN FechaPago >= ${INICIO_MES}
                           AND Origen <> 'Recompensa' THEN MontoTotal END), 0) AS ingresosMes,
         COALESCE(SUM(CASE WHEN FechaPago >= ${INICIO_MES_ANTERIOR}
                           AND FechaPago < ${INICIO_MES}
                           AND Origen <> 'Recompensa' THEN MontoTotal END), 0) AS ingresosMesAnterior,
         COALESCE(SUM(CASE WHEN FechaPago >= ${INICIO_MES}
                           AND Origen = 'Empresarial' THEN MontoTotal END), 0) AS pagadoEmpresas,
         COALESCE(SUM(CASE WHEN FechaPago >= ${INICIO_MES}
                           AND Origen <> 'Recompensa' THEN ComisionPsynex END), 0) AS comisionMes,
         -- Las citas gratis las paga Psynex: lo que se le paga al psicólogo es el gasto
         COALESCE(SUM(CASE WHEN FechaPago >= ${INICIO_MES}
                           AND Origen = 'Recompensa' THEN MontoNeto END), 0) AS gastoRecompensas
       FROM pagos
       WHERE EstadoPago = 'Completado'`,
    );

    const [config] = await conexion.query(
      `SELECT Valor FROM configuracionplataforma WHERE Clave = 'ComisionPorcentaje' LIMIT 1`,
    );

    // Top 5 de psicólogos por citas realizadas (histórico)
    const ranking = await conexion.query(
      `SELECT u.NombreCompleto AS nombre, COUNT(*) AS citas
       FROM citas c
       JOIN perfilpsicologo p ON p.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = p.UsuarioId
       WHERE c.Estado = 'Completada'
       GROUP BY u.UsuarioId, u.NombreCompleto
       ORDER BY citas DESC
       LIMIT 5`,
    );

    const [recompensa] = await conexion.query(
      `SELECT CupoCitas, CitasOtorgadas
       FROM recompensasperiodo
       WHERE Anio = YEAR(NOW()) AND Mes = MONTH(NOW())
       LIMIT 1`,
    );

    const n = (v: unknown) => Number(v ?? 0);
    return {
      ingresosMes: n(totales?.ingresosMes),
      ingresosMesAnterior: n(totales?.ingresosMesAnterior),
      pagadoEmpresas: n(totales?.pagadoEmpresas),
      comisionMes: n(totales?.comisionMes),
      gastoRecompensas: n(totales?.gastoRecompensas),
      comisionPorcentaje: n(config?.Valor ?? 30),
      rankingPsicologos: ranking.map((r: Record<string, unknown>) => ({
        nombre: String(r.nombre),
        citas: n(r.citas),
      })),
      recompensas: {
        cupo: n(recompensa?.CupoCitas),
        otorgadas: n(recompensa?.CitasOtorgadas),
        configurado: Boolean(recompensa),
      },
    };
  },

  // ------------------- Pagos a psicólogos (RF-161 a RF-164) -------------------

  // Lo que se le debe a cada psicólogo (pagos completados aún no transferidos),
  // con su cuenta principal para hacer la transferencia.
  async transferenciasPendientes() {
    return await conexion.query(
      `SELECT ps.PerfilId, u.NombreCompleto AS PsicologoNombre, u.Email AS PsicologoEmail,
              COUNT(p.PagoId) AS PagosPendientes,
              SUM(p.MontoNeto) AS TotalPorTransferir,
              MIN(p.FechaPago) AS PagoMasAntiguo,
              cu.CuentaId, cu.Banco, cu.TipoCuenta, cu.NumeroCuenta, cu.TitularCuenta,
              cu.EstaVerificada AS CuentaVerificada
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       LEFT JOIN cuentaspsicologo cu ON cu.PerfilcId = ps.PerfilId AND cu.EsPrincipal = 1
       WHERE p.EstadoPago = 'Completado' AND p.EstadoTransferencia = 'Pendiente'
       GROUP BY ps.PerfilId, u.NombreCompleto, u.Email,
                cu.CuentaId, cu.Banco, cu.TipoCuenta, cu.NumeroCuenta, cu.TitularCuenta, cu.EstaVerificada
       ORDER BY PagoMasAntiguo ASC`,
    );
  },

  // Marca como transferido UN pago, o TODOS los pendientes de un psicólogo.
  // Devuelve cuántos pagos se marcaron. Avisa al psicólogo con una notificación.
  async marcarTransferido(filtro: { pagoId?: string; perfilId?: string }, comprobante?: string) {
    return await conexion.transaction(async (conn) => {
      const condicion = filtro.pagoId ? "p.PagoId = ?" : "c.PsicologoId = ?";
      const valor = filtro.pagoId ?? filtro.perfilId;

      const pagos = (await conn.query(
        `SELECT p.PagoId, p.MontoNeto, ps.UsuarioId
         FROM pagos p
         JOIN citas c ON c.CitaId = p.CitaId
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         WHERE ${condicion} AND p.EstadoPago = 'Completado' AND p.EstadoTransferencia = 'Pendiente'`,
        [valor],
      )) as Record<string, unknown>[];
      if (!pagos.length) return 0;

      const ids = pagos.map((x) => String(x.PagoId));
      await conn.execute(
        `UPDATE pagos
         SET EstadoTransferencia = 'Transferido', FechaTransferencia = NOW(),
             ComprobanteTransferencia = ?
         WHERE PagoId IN (${ids.map(() => "?").join(", ")})`,
        [comprobante ?? null, ...ids],
      );

      const total = pagos.reduce((s, x) => s + Number(x.MontoNeto), 0);
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Recibiste una transferencia', ?, 0, NOW())`,
        [
          crypto.randomUUID(),
          pagos[0].UsuarioId,
          `Psynex te transfirió $${Math.round(total).toLocaleString("es-CO")} (${pagos.length} cita(s)).`,
        ],
      );
      return pagos.length;
    });
  },

  // El admin confirma que la cuenta bancaria del psicólogo es válida
  async verificarCuenta(cuentaId: string) {
    const r = await conexion.execute(
      `UPDATE cuentaspsicologo SET EstaVerificada = 1 WHERE CuentaId = ?`,
      [cuentaId],
    );
    return (r.affectedRows ?? 0) > 0;
  },
};