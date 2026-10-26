import { conexion } from "../conexion.ts";
import type {
  ListarMovimientosQuery,
  CuentaInput,
  ActualizarCuentaInput,
  ReclamoInput,
} from "../../Validators/Psicologo/FinanzasPsicologoValidator.ts";

// Pagos completados de las citas de este psicólogo
const PAGOS_DEL_PSICOLOGO = `
  FROM pagos p
  JOIN citas c ON c.CitaId = p.CitaId
  WHERE c.PsicologoId = ? AND p.EstadoPago = 'Completado'
`;

// Solo se muestran los últimos 4 dígitos de la cuenta
const enmascarar = (numero: string) => `•••• ${String(numero).slice(-4)}`;

export const FinanzasPsicologoModel = {

  // Tarjetas del resumen (mes actual + saldos)
  async resumen(perfilId: string) {
    const INICIO_MES = "DATE_FORMAT(NOW(), '%Y-%m-01')";
    const [r] = await conexion.query(
      `SELECT
         COALESCE(SUM(CASE WHEN p.FechaPago >= ${INICIO_MES} THEN p.MontoNeto END), 0) AS netoMes,
         COALESCE(SUM(CASE WHEN p.FechaPago >= ${INICIO_MES} THEN p.ComisionPsynex END), 0) AS comisionMes,
         COALESCE(SUM(CASE WHEN p.FechaPago >= ${INICIO_MES} THEN 1 ELSE 0 END), 0) AS citasPagadasMes,
         COALESCE(SUM(CASE WHEN p.EstadoTransferencia = 'Pendiente' THEN p.MontoNeto END), 0) AS porTransferir,
         COALESCE(SUM(CASE WHEN p.EstadoTransferencia = 'Transferido' THEN p.MontoNeto END), 0) AS transferido,
         COALESCE(SUM(CASE WHEN p.Origen = 'Recompensa' THEN 1 ELSE 0 END), 0) AS citasGratuitas
       ${PAGOS_DEL_PSICOLOGO}`,
      [perfilId],
    );
    const [config] = await conexion.query(
      `SELECT Valor FROM configuracionplataforma WHERE Clave = 'ComisionPorcentaje' LIMIT 1`,
    );
    const n = (v: unknown) => Number(v ?? 0);
    return {
      netoMes: n(r?.netoMes),
      comisionMes: n(r?.comisionMes),
      citasPagadasMes: n(r?.citasPagadasMes),
      porTransferir: n(r?.porTransferir),
      transferido: n(r?.transferido),
      citasGratuitas: n(r?.citasGratuitas),
      comisionPorcentaje: n(config?.Valor ?? 30),
    };
  },

  // Movimientos: un registro por cada pago completado de sus citas
  async movimientos(perfilId: string, f: ListarMovimientosQuery) {
    const extra = f.transferencia !== "todos" ? "AND p.EstadoTransferencia = ?" : "";
    const params: (string | number)[] = [perfilId];
    if (extra) params.push(f.transferencia);

    const [cuenta] = await conexion.query(
      `SELECT COUNT(*) AS total ${PAGOS_DEL_PSICOLOGO} ${extra}`,
      params,
    );
    const datos = await conexion.query(
      `SELECT p.PagoId, p.CitaId, p.Origen, p.MontoTotal, p.PorcentajeComision,
              p.ComisionPsynex, p.MontoNeto, p.EstadoTransferencia, p.FechaPago,
              p.FechaTransferencia, c.FechaHora AS CitaFecha, c.Modalidad,
              CASE WHEN pp.EsAnonimo = 1 THEN 'Paciente anónimo'
                   ELSE COALESCE(u.NombreCompleto, 'Paciente') END AS PacienteNombre
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       LEFT JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       LEFT JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
       WHERE c.PsicologoId = ? AND p.EstadoPago = 'Completado' ${extra}
       ORDER BY p.FechaPago DESC
       LIMIT ? OFFSET ?`,
      [...params, f.porPagina, (f.pagina - 1) * f.porPagina],
    );
    return { datos, total: Number(cuenta?.total ?? 0) };
  },

  // ------------------------- Cuentas bancarias -------------------------

  async listarCuentas(perfilId: string) {
    const filas = await conexion.query(
      `SELECT CuentaId, TipoCuenta, NumeroCuenta, Banco, TitularCuenta,
              EstaVerificada, EsPrincipal, CreadoEn
       FROM cuentaspsicologo
       WHERE PerfilcId = ?
       ORDER BY EsPrincipal DESC, CreadoEn DESC`,
      [perfilId],
    );
    return filas.map((c: Record<string, unknown>) => ({
      ...c,
      NumeroCuenta: enmascarar(String(c.NumeroCuenta)),
    }));
  },

  // La primera cuenta queda como principal automáticamente
  async crearCuenta(perfilId: string, data: CuentaInput) {
    const cuentaId = crypto.randomUUID();
    await conexion.transaction(async (conn) => {
      const existentes = (await conn.query(
        `SELECT COUNT(*) AS n FROM cuentaspsicologo WHERE PerfilcId = ?`,
        [perfilId],
      )) as Record<string, unknown>[];
      const principal = data.esPrincipal || Number(existentes[0]?.n ?? 0) === 0;
      if (principal) {
        await conn.execute(`UPDATE cuentaspsicologo SET EsPrincipal = 0 WHERE PerfilcId = ?`, [perfilId]);
      }
      await conn.execute(
        `INSERT INTO cuentaspsicologo
           (CuentaId, PerfilcId, TipoCuenta, NumeroCuenta, Banco, TitularCuenta,
            EstaVerificada, EsPrincipal, CreadoEn)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW())`,
        [cuentaId, perfilId, data.tipoCuenta, data.numeroCuenta, data.banco, data.titularCuenta, principal ? 1 : 0],
      );
    });
    return cuentaId;
  },

  // Si cambian los datos bancarios, la cuenta vuelve a quedar sin verificar
  async actualizarCuenta(perfilId: string, cuentaId: string, data: ActualizarCuentaInput) {
    return await conexion.transaction(async (conn) => {
      const [actual] = (await conn.query(
        `SELECT CuentaId FROM cuentaspsicologo WHERE CuentaId = ? AND PerfilcId = ? LIMIT 1`,
        [cuentaId, perfilId],
      )) as Record<string, unknown>[];
      if (!actual) return false;

      const campos: string[] = [];
      const valores: unknown[] = [];
      const mapa: Record<string, string> = {
        tipoCuenta: "TipoCuenta",
        numeroCuenta: "NumeroCuenta",
        banco: "Banco",
        titularCuenta: "TitularCuenta",
      };
      for (const [clave, columna] of Object.entries(mapa)) {
        const valor = data[clave as keyof ActualizarCuentaInput];
        if (valor !== undefined) {
          campos.push(`${columna} = ?`);
          valores.push(valor);
        }
      }
      if (campos.length) campos.push("EstaVerificada = 0");

      if (data.esPrincipal) {
        await conn.execute(`UPDATE cuentaspsicologo SET EsPrincipal = 0 WHERE PerfilcId = ?`, [perfilId]);
        campos.push("EsPrincipal = 1");
      }
      if (campos.length) {
        await conn.execute(
          `UPDATE cuentaspsicologo SET ${campos.join(", ")} WHERE CuentaId = ?`,
          [...valores, cuentaId],
        );
      }
      return true;
    });
  },

  async eliminarCuenta(perfilId: string, cuentaId: string) {
    const r = await conexion.execute(
      `DELETE FROM cuentaspsicologo WHERE CuentaId = ? AND PerfilcId = ?`,
      [cuentaId, perfilId],
    );
    if ((r.affectedRows ?? 0) === 0) return false;

    // Si borró la cuenta oficial, la más reciente que quede pasa a ser la oficial
    const [hayPrincipal] = await conexion.query(
      `SELECT 1 AS ok FROM cuentaspsicologo WHERE PerfilcId = ? AND EsPrincipal = 1 LIMIT 1`,
      [perfilId],
    );
    if (!hayPrincipal) {
      await conexion.execute(
        `UPDATE cuentaspsicologo SET EsPrincipal = 1 WHERE PerfilcId = ? ORDER BY CreadoEn DESC LIMIT 1`,
        [perfilId],
      );
    }
    return true;
  },

  // ------------------------------ Reclamos ------------------------------

  async listarReclamos(perfilId: string) {
    return await conexion.query(
      `SELECT ReclamoId, PagoId, Motivo, Descripcion, Estado, Respuesta, CreadoEn, RespondidoEn
       FROM reclamospago WHERE PerfilId = ? ORDER BY CreadoEn DESC`,
      [perfilId],
    );
  },

  // Devuelve null si el pago indicado no es de una cita de este psicólogo
  async crearReclamo(perfilId: string, data: ReclamoInput) {
    if (data.pagoId) {
      const propio = await conexion.query(
        `SELECT 1 FROM pagos p JOIN citas c ON c.CitaId = p.CitaId
         WHERE p.PagoId = ? AND c.PsicologoId = ? LIMIT 1`,
        [data.pagoId, perfilId],
      );
      if (!propio.length) return null;
    }
    const reclamoId = crypto.randomUUID();
    await conexion.execute(
      `INSERT INTO reclamospago (ReclamoId, PerfilId, PagoId, Motivo, Descripcion, Estado, CreadoEn)
       VALUES (?, ?, ?, ?, ?, 'Abierto', NOW())`,
      [reclamoId, perfilId, data.pagoId ?? null, data.motivo, data.descripcion],
    );
    return reclamoId;
  },
};
