// =====================================================================
// cambio: ARCHIVO NUEVO — Beneficio de la empresa del lado del PACIENTE.
// La empresa compra un plan, el admin lo aprueba y se genera un código
// (codigosvinculacion). El trabajador (paciente) escribe ese código aquí:
//   - se vincula al contrato (empleadosvinculados) y ocupa un cupo
//   - cada cita confirmada la puede "pagar" con una sesión del beneficio
//     (pagos.Origen = 'Empresarial'); el psicólogo recibe su neto igual.
// No cambia nada de lo que hizo la empresa: solo usa sus tablas.
// =====================================================================
import { conexion } from "../conexion.ts";
import { calcularMontos, obtenerPorcentajeComision } from "../../Helpers/Pagos.ts";

type Fila = Record<string, unknown>;
type Resultado<T> = T | { error: string; status: number };
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// Vinculación vigente del paciente (contrato activo y sin vencer)
const SELECT_VINCULACION = `
  SELECT e.VinculacionId, e.ContratoId, e.SesionesUsadas,
         c.SesionesPorEmpleado, c.NumeroEmpleadosCubiertos, c.ValorTotal,
         DATE_FORMAT(c.FechaFin, '%Y-%m-%d') AS FechaFin,
         cv.Codigo, pe.NombreEmpresa, pe.UsuarioId AS EmpresaUsuarioId
  FROM empleadosvinculados e
  JOIN contratoscorporativos c ON c.ContratoId = e.ContratoId
  JOIN perfilempresa pe ON pe.PerfileId = c.EmpresaId
  LEFT JOIN codigosvinculacion cv ON cv.ContratoId = c.ContratoId
  WHERE e.UsuarioId = ? AND c.Estado = 'Activo' AND (c.FechaFin IS NULL OR c.FechaFin > NOW())
  ORDER BY c.FechaFin DESC
  LIMIT 1`;

const armar = (f: Fila) => {
  const totales = Number(f.SesionesPorEmpleado ?? 0);
  const usadas = Number(f.SesionesUsadas ?? 0);
  return {
    codigo: texto(f.Codigo),
    empresa: texto(f.NombreEmpresa),
    vence: texto(f.FechaFin),
    sesionesTotales: totales,
    sesionesUsadas: usadas,
    sesionesDisponibles: Math.max(0, totales - usadas),
  };
};

async function notificar(usuarioId: string, titulo: string, mensaje: string) {
  await conexion.execute(
    `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
     VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
    [crypto.randomUUID(), usuarioId, titulo, mensaje],
  ).catch((e) => console.error("Notificación de beneficio:", e));
}

export const BeneficioPacienteModel = {
  async estado(usuarioId: string) {
    const [f] = await conexion.query(SELECT_VINCULACION, [usuarioId]) as Fila[];
    return f ? armar(f) : null;
  },

  async activar(usuarioId: string, codigoEscrito: string): Promise<Resultado<ReturnType<typeof armar>>> {
    const codigo = codigoEscrito.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) {
      return { error: "El código tiene 8 caracteres separados por un guion, por ejemplo PSYX-KQ3S.", status: 400 };
    }
    if (await this.estado(usuarioId)) {
      return { error: "Ya tienes un beneficio de empresa activo.", status: 409 };
    }

    const r = await conexion.transaction(async (conn) => {
      const [cv] = await conn.query(
        `SELECT cv.CodigoId, cv.CupoMaximo, cv.CupoUsado, c.ContratoId, c.Estado, c.FechaFin,
                pe.NombreEmpresa, pe.UsuarioId AS EmpresaUsuarioId,
                (c.FechaFin IS NOT NULL AND c.FechaFin <= NOW()) AS Vencido
         FROM codigosvinculacion cv
         JOIN contratoscorporativos c ON c.ContratoId = cv.ContratoId
         JOIN perfilempresa pe ON pe.PerfileId = c.EmpresaId
         WHERE cv.Codigo = ? LIMIT 1 FOR UPDATE`,
        [codigo],
      ) as Fila[];
      if (!cv || texto(cv.Estado) !== "Activo" || Number(cv.Vencido) === 1) {
        return { error: "Ese código no existe o ya venció. Revísalo con tu empresa.", status: 404 };
      }
      const [ya] = await conn.query(
        `SELECT VinculacionId FROM empleadosvinculados WHERE ContratoId = ? AND UsuarioId = ? LIMIT 1`,
        [cv.ContratoId, usuarioId],
      ) as Fila[];
      if (ya) return { error: "Ya usaste este código.", status: 409 };
      if (Number(cv.CupoUsado) >= Number(cv.CupoMaximo)) {
        return { error: "Ese código ya no tiene cupos disponibles. Habla con tu empresa.", status: 409 };
      }

      await conn.execute(
        `INSERT INTO empleadosvinculados (VinculacionId, ContratoId, UsuarioId, SesionesUsadas, VinculadoEn)
         VALUES (?, ?, ?, 0, NOW())`,
        [crypto.randomUUID(), cv.ContratoId, usuarioId],
      );
      await conn.execute(`UPDATE codigosvinculacion SET CupoUsado = CupoUsado + 1 WHERE CodigoId = ?`, [cv.CodigoId]);
      return { empresaUsuarioId: texto(cv.EmpresaUsuarioId) };
    });
    if ("error" in r) return r as { error: string; status: number };

    const beneficio = await this.estado(usuarioId);
    if (!beneficio) return { error: "No se pudo activar el beneficio.", status: 500 };
    // Aviso a la empresa: un trabajador se vinculó
    const [u] = await conexion.query(`SELECT NombreCompleto FROM usuarios WHERE UsuarioId = ? LIMIT 1`, [usuarioId]) as Fila[];
    await notificar(r.empresaUsuarioId, "Trabajador vinculado", `${texto(u?.NombreCompleto) || "Un trabajador"} activó el código ${codigo}.`);
    return beneficio;
  },

  // Quitar el código: solo si todavía no ha usado sesiones (libera el cupo)
  async quitar(usuarioId: string): Promise<Resultado<{ ok: true }>> {
    const [f] = await conexion.query(SELECT_VINCULACION, [usuarioId]) as Fila[];
    if (!f) return { error: "No tienes un beneficio activo.", status: 404 };
    if (Number(f.SesionesUsadas ?? 0) > 0) {
      return { error: "Ya usaste sesiones de este beneficio, por eso no se puede quitar.", status: 409 };
    }
    await conexion.transaction(async (conn) => {
      await conn.execute(`DELETE FROM empleadosvinculados WHERE VinculacionId = ?`, [f.VinculacionId]);
      await conn.execute(
        `UPDATE codigosvinculacion SET CupoUsado = GREATEST(CupoUsado - 1, 0) WHERE ContratoId = ?`,
        [f.ContratoId],
      );
    });
    return { ok: true };
  },

  // Pagar una cita confirmada con una sesión del beneficio
  async usarEnCita(usuarioId: string, citaId: string): Promise<Resultado<{ empresa: string; sesionesDisponibles: number }>> {
    const [cita] = await conexion.query(
      `SELECT c.CitaId, c.Estado, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora,
              ps.UsuarioId AS PsicologoUsuarioId, up.NombreCompleto AS Paciente,
              (SELECT COUNT(*) FROM pagos p WHERE p.CitaId = c.CitaId AND p.EstadoPago = 'Completado') AS Pagada
       FROM citas c
       JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       WHERE c.CitaId = ? AND pp.UsuarioId = ? LIMIT 1`,
      [citaId, usuarioId],
    ) as Fila[];
    if (!cita) return { error: "Cita no encontrada.", status: 404 };
    if (texto(cita.Estado) !== "Confirmada") {
      return { error: "Solo puedes usar tu beneficio cuando el psicólogo haya aceptado la cita.", status: 409 };
    }
    if (Number(cita.Pagada ?? 0) > 0) return { error: "Esta cita ya está pagada.", status: 409 };

    const porcentaje = await obtenerPorcentajeComision();

    const r = await conexion.transaction(async (conn) => {
      const [v] = await conn.query(`${SELECT_VINCULACION} FOR UPDATE`, [usuarioId]) as Fila[];
      if (!v) return { error: "No tienes un beneficio de empresa activo.", status: 409 };
      if (Number(v.SesionesUsadas) >= Number(v.SesionesPorEmpleado)) {
        return { error: "Ya usaste todas las sesiones de tu beneficio.", status: 409 };
      }
      // Valor de una sesión del plan empresarial (para el neto del psicólogo)
      const sesionesContrato = Math.max(1, Number(v.NumeroEmpleadosCubiertos) * Number(v.SesionesPorEmpleado));
      const valorSesion = Math.round(Number(v.ValorTotal ?? 0) / sesionesContrato);
      const m = calcularMontos(valorSesion, porcentaje);

      await conn.execute(`UPDATE empleadosvinculados SET SesionesUsadas = SesionesUsadas + 1 WHERE VinculacionId = ?`, [v.VinculacionId]);
      await conn.execute(`DELETE FROM pagos WHERE CitaId = ? AND EstadoPago = 'Pendiente'`, [citaId]);
      await conn.execute(
        `INSERT INTO pagos
           (PagoId, CitaId, CompraId, MetodoPagoId, Origen, MontoTotal, MontoAnticipo, MontoPendiente,
            PorcentajeComision, ComisionPsynex, MontoNeto, EsGratuita, EstadoPago, EstadoTransferencia,
            Pasarela, ReferenciaPasarela, TransaccionId, FechaPago, CreadoEn)
         VALUES (?, ?, NULL, NULL, 'Empresarial', ?, ?, 0, ?, ?, ?, 0, 'Completado', 'Pendiente',
                 NULL, ?, NULL, NOW(), NOW())`,
        [crypto.randomUUID(), citaId, m.montoTotal, m.montoTotal, m.porcentajeComision, m.comisionPsynex, m.montoNeto, texto(v.Codigo)],
      );
      return {
        empresa: texto(v.NombreEmpresa),
        sesionesDisponibles: Number(v.SesionesPorEmpleado) - Number(v.SesionesUsadas) - 1,
      };
    });
    if ("error" in r) return r as { error: string; status: number };

    await notificar(
      texto(cita.PsicologoUsuarioId),
      "Pago recibido",
      `${texto(cita.Paciente) || "Tu paciente"} pagó la cita del ${texto(cita.FechaHora)} con el beneficio de su empresa.`,
    );
    return r;
  },
};
