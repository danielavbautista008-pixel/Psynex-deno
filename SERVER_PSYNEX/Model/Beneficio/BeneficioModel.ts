// =====================================================================
// Model/Beneficio/BeneficioModel.ts
// Beneficio empresarial (opción B): la empresa le compra a Psynex un plan
// para N trabajadores. El pago se hace por transferencia con una orden de
// pago; el administrador confirma el pago, el contrato queda Activo y el
// sistema genera un código para que los trabajadores se vinculen.
//
// Tablas: contratoscorporativos, codigosvinculacion, empleadosvinculados,
//         planes, perfilempresa, configuracionplataforma, notificaciones.
// =====================================================================
import { conexion } from "../conexion.ts";
import { avisarAdmins } from "../../Helpers/AvisosAdmin.ts"; // cambio: avisos al administrador (correo + campanita)
import type { BancoInput, SolicitarPlanInput } from "../../Validators/Beneficio/BeneficioValidator.ts";

// Datos bancarios de Psynex que salen en la orden de pago
// (se guardan en configuracionplataforma, una clave por dato)
const CLAVES_BANCO = {
  banco: "BancoNombre",
  tipoCuenta: "BancoTipoCuenta",
  numeroCuenta: "BancoNumeroCuenta",
  titular: "BancoTitular",
  nit: "BancoNit",
} as const;

export type DatosBanco = Record<keyof typeof CLAVES_BANCO, string>;

// Letras y números fáciles de dictar (sin 0/O ni 1/I/L)
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PALABRAS_VACIAS = new Set(["EMPRESA", "SAS", "S", "A", "LTDA", "DE", "LA", "EL", "Y", "DEL", "LOS", "LAS", "CIA"]);

function prefijoCodigo(nombreEmpresa: string): string {
  const palabras = nombreEmpresa
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z ]/g, " ")
    .split(" ").filter((p) => p && !PALABRAS_VACIAS.has(p));
  const letras = palabras.join("").replace(/[^A-Z]/g, "");
  return (letras + "PSYX").slice(0, 4);
}

function parteAzar(n = 4): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

// Un contrato Activo cuya fecha final ya pasó se muestra como "Vencido"
// (no se cambia en la base de datos: la fecha manda).
function estadoVisible(estado: string, fechaFin: Date | null): string {
  if (estado === "Activo" && fechaFin && new Date(fechaFin).getTime() < Date.now()) return "Vencido";
  return estado;
}

// deno-lint-ignore no-explicit-any
function mapearContrato(c: any) {
  const empleados = Number(c.NumeroEmpleadosCubiertos);
  const sesionesPorEmpleado = Number(c.SesionesPorEmpleado);
  return {
    id: String(c.ContratoId),
    numeroOrden: c.NumeroOrden ? String(c.NumeroOrden) : null,
    estado: estadoVisible(String(c.Estado), c.FechaFin),
    plan: { id: c.PlanId ? String(c.PlanId) : null, nombre: String(c.PlanNombre ?? c.Descripcion ?? "Plan empresarial") },
    duracionDias: c.DuracionDias != null ? Number(c.DuracionDias) : null,
    empleados,
    sesionesPorEmpleado,
    sesionesTotales: empleados * sesionesPorEmpleado,
    valorTotal: Number(c.ValorTotal),
    valorPorEmpleado: empleados > 0 ? Number(c.ValorTotal) / empleados : 0,
    tieneComprobante: Boolean(c.ComprobantePago),
    motivoRechazo: c.MotivoRechazo ? String(c.MotivoRechazo) : null,
    creadoEn: c.CreadoEn,
    fechaInicio: c.FechaInicio ?? null,
    fechaFin: c.FechaFin ?? null,
    codigo: c.Codigo ? String(c.Codigo) : null,
    vinculados: Number(c.Vinculados ?? 0),
    sesionesUsadas: Number(c.SesionesUsadas ?? 0),
  };
}
export type ContratoBeneficio = ReturnType<typeof mapearContrato>;

const SELECT_CONTRATO = `
  SELECT c.*, p.Nombre AS PlanNombre, p.DuracionDias, cv.Codigo,
         (SELECT COUNT(*) FROM empleadosvinculados e WHERE e.ContratoId = c.ContratoId) AS Vinculados,
         (SELECT COALESCE(SUM(e.SesionesUsadas), 0) FROM empleadosvinculados e WHERE e.ContratoId = c.ContratoId) AS SesionesUsadas
  FROM contratoscorporativos c
  LEFT JOIN planes p ON p.PlanId = c.PlanId
  LEFT JOIN codigosvinculacion cv ON cv.ContratoId = c.ContratoId`;

async function notificar(usuarioId: string, titulo: string, mensaje: string) {
  await conexion.execute(
    `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
     VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
    [crypto.randomUUID(), usuarioId, titulo, mensaje],
  ).catch((e) => console.error("Notificación de beneficio:", e));
}

// cambio: ya no se usa (ahora se usa avisarAdmins, que además manda correo); se deja por si se necesita
// deno-lint-ignore no-unused-vars
async function notificarAdmins(titulo: string, mensaje: string) {
  const admins = await conexion.query(
    `SELECT UsuarioId FROM usuarios WHERE Rol = 'Admin' AND EstadoActivo = 1`,
  ).catch(() => []);
  for (const a of admins) await notificar(String(a.UsuarioId), titulo, mensaje);
}

export const BeneficioModel = {

  // ------------------------------ Empresa ------------------------------

  async empresaDe(usuarioId: string) {
    const [e] = await conexion.query(
      `SELECT PerfileId, NombreEmpresa, Nit, EstaVerificada FROM perfilempresa WHERE UsuarioId = ? LIMIT 1`,
      [usuarioId],
    );
    return e
      ? {
        id: String(e.PerfileId),
        nombre: String(e.NombreEmpresa),
        nit: String(e.Nit ?? ""),
        verificada: Number(e.EstaVerificada) === 1,
      }
      : null;
  },

  async banco(): Promise<DatosBanco | null> {
    const filas = await conexion.query(
      `SELECT Clave, Valor FROM configuracionplataforma WHERE Clave IN (?, ?, ?, ?, ?)`,
      Object.values(CLAVES_BANCO),
    );
    const mapa = new Map(filas.map((f: { Clave: string; Valor: string }) => [String(f.Clave), String(f.Valor ?? "")]));
    const datos = Object.fromEntries(
      Object.entries(CLAVES_BANCO).map(([k, clave]) => [k, mapa.get(clave) ?? ""]),
    ) as DatosBanco;
    return datos.numeroCuenta ? datos : null;
  },

  async guardarBanco(d: BancoInput) {
    for (const [k, clave] of Object.entries(CLAVES_BANCO)) {
      await conexion.execute(
        `INSERT INTO configuracionplataforma (ConfigId, Clave, Valor, Descripcion, ActualizadoEn)
         VALUES (UUID(), ?, ?, 'Cuenta bancaria de Psynex para las órdenes de pago empresariales.', NOW())
         ON DUPLICATE KEY UPDATE Valor = VALUES(Valor), ActualizadoEn = NOW()`,
        [clave, d[k as keyof BancoInput]],
      );
    }
  },

  // Planes empresariales publicados
  async planes() {
    const filas = await conexion.query(
      `SELECT PlanId, Nombre, Descripcion, Beneficios, Precio, Moneda, CantidadSesiones, DuracionDias
       FROM planes
       WHERE Tipo = 'Empresarial' AND Publicado = 1
       ORDER BY Orden, Precio`,
    );
    // deno-lint-ignore no-explicit-any
    return filas.map((p: any) => ({
      id: String(p.PlanId),
      nombre: String(p.Nombre),
      descripcion: String(p.Descripcion ?? ""),
      beneficios: String(p.Beneficios ?? "").split(/\r?\n/).map((b) => b.trim()).filter(Boolean),
      precioPorEmpleado: Number(p.Precio),
      moneda: String(p.Moneda ?? "COP"),
      sesiones: Number(p.CantidadSesiones ?? 0),
      duracionDias: Number(p.DuracionDias ?? 0),
    }));
  },

  async contratosDeEmpresa(empresaId: string) {
    const filas = await conexion.query(`${SELECT_CONTRATO} WHERE c.EmpresaId = ? ORDER BY c.CreadoEn DESC`, [empresaId]);
    return filas.map(mapearContrato);
  },

  // Si ya hay una solicitud en curso o un plan vigente, no deja pedir otro
  async bloqueoSolicitud(empresaId: string): Promise<string | null> {
    const [c] = await conexion.query(
      `SELECT Estado, FechaFin FROM contratoscorporativos
       WHERE EmpresaId = ?
         AND (Estado IN ('Pendiente', 'Rechazado') OR (Estado = 'Activo' AND (FechaFin IS NULL OR FechaFin > NOW())))
       ORDER BY CreadoEn DESC LIMIT 1`,
      [empresaId],
    );
    if (!c) return null;
    if (c.Estado === "Activo") return "Ya tienes un plan activo. Podrás contratar otro cuando termine su vigencia.";
    if (c.Estado === "Rechazado") return "Tienes una solicitud con el pago rechazado. Corrígela o cancélala en Mi beneficio.";
    return "Ya tienes una solicitud en curso. Revísala en Mi beneficio.";
  },

  async solicitar(empresaId: string, d: SolicitarPlanInput) {
    const bloqueo = await this.bloqueoSolicitud(empresaId);
    if (bloqueo) return { error: bloqueo, status: 409 };

    const [plan] = await conexion.query(
      `SELECT PlanId, Nombre, Precio, CantidadSesiones, DuracionDias FROM planes
       WHERE PlanId = ? AND Tipo = 'Empresarial' AND Publicado = 1 LIMIT 1`,
      [d.planId],
    );
    if (!plan) return { error: "Ese plan no está disponible.", status: 404 };
    const sesiones = Number(plan.CantidadSesiones ?? 0);
    if (sesiones < 1 || Number(plan.DuracionDias ?? 0) < 1) {
      return { error: "Este plan todavía no tiene sesiones o vigencia configuradas.", status: 409 };
    }
    const valorTotal = Math.round(Number(plan.Precio) * d.empleados * 100) / 100;

    // Número de orden consecutivo por año: OP-2026-0001
    for (let intento = 0; intento < 3; intento++) {
      const anio = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 4);
      const prefijo = `OP-${anio}-`;
      const [m] = await conexion.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(NumeroOrden, ?) AS UNSIGNED)), 0) AS n
         FROM contratoscorporativos WHERE NumeroOrden LIKE ?`,
        [prefijo.length + 1, `${prefijo}%`],
      );
      const numeroOrden = `${prefijo}${String(Number(m?.n ?? 0) + 1).padStart(4, "0")}`;
      const id = crypto.randomUUID();
      try {
        await conexion.execute(
          `INSERT INTO contratoscorporativos
             (ContratoId, EmpresaId, PlanId, PsicologoId, NumeroEmpleadosCubiertos, SesionesPorEmpleado,
              ValorTotal, NumeroOrden, Modalidad, Descripcion, Estado, CreadoEn)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'Mixta', ?, 'Pendiente', NOW())`,
          [id, empresaId, plan.PlanId, d.empleados, sesiones, valorTotal, numeroOrden, String(plan.Nombre).slice(0, 500)],
        );
        return { ok: true as const, id, numeroOrden };
      } catch (e) {
        // Otro registro tomó el mismo número al mismo tiempo: se intenta de nuevo
        if (String(e).includes("UQ_Contratos_Orden") && intento < 2) continue;
        throw e;
      }
    }
    return { error: "No se pudo generar la orden de pago, intenta de nuevo.", status: 500 };
  },

  async contratoDeEmpresa(empresaId: string, contratoId: string) {
    const [c] = await conexion.query(
      `SELECT ContratoId, Estado, ComprobantePago, NumeroOrden FROM contratoscorporativos
       WHERE ContratoId = ? AND EmpresaId = ? LIMIT 1`,
      [contratoId, empresaId],
    );
    return c ?? null;
  },

  // Guarda el comprobante. Si el pago había sido rechazado, vuelve a revisión.
  async guardarComprobante(empresa: { id: string; nombre: string }, contratoId: string, ruta: string) {
    const c = await this.contratoDeEmpresa(empresa.id, contratoId);
    if (!c) return { error: "No encontramos esta solicitud.", status: 404 };
    if (!["Pendiente", "Rechazado"].includes(String(c.Estado))) {
      return { error: "Esta solicitud ya no recibe comprobantes.", status: 409 };
    }
    await conexion.execute(
      `UPDATE contratoscorporativos
       SET ComprobantePago = ?, Estado = 'Pendiente', MotivoRechazo = NULL
       WHERE ContratoId = ?`,
      [ruta, contratoId],
    );
    // cambio: además de la notificación, al administrador le llega un correo
    await avisarAdmins(
      "Comprobante de pago empresarial",
      `${empresa.nombre} subió el comprobante de la orden ${c.NumeroOrden}. Revísalo en Pagos de empresas.`,
      "/Administrador/pagosempresas",
      {
        boton: "Revisar comprobante",
        detalles: [
          ["Empresa", empresa.nombre],
          ["Orden", String(c.NumeroOrden ?? "")],
        ],
      },
    );
    return { ok: true as const, anterior: c.ComprobantePago ? String(c.ComprobantePago) : null };
  },

  // La empresa puede cancelar una solicitud que todavía no se ha aprobado
  async cancelar(empresaId: string, contratoId: string) {
    const c = await this.contratoDeEmpresa(empresaId, contratoId);
    if (!c) return { error: "No encontramos esta solicitud.", status: 404 };
    if (!["Pendiente", "Rechazado"].includes(String(c.Estado))) {
      return { error: "Solo se pueden cancelar solicitudes que no han sido aprobadas.", status: 409 };
    }
    await conexion.execute(`DELETE FROM contratoscorporativos WHERE ContratoId = ?`, [contratoId]);
    return { ok: true as const, comprobante: c.ComprobantePago ? String(c.ComprobantePago) : null };
  },

  // --------------------------- Administrador ---------------------------

  async listarAdmin(estado: string) {
    const where = estado === "todos" ? "" : "WHERE c.Estado = ?";
    const filas = await conexion.query(
      `SELECT x.*, pe.NombreEmpresa, pe.Nit, u.Email AS EmpresaEmail
       FROM (${SELECT_CONTRATO} ${where}) x
       JOIN perfilempresa pe ON pe.PerfileId = x.EmpresaId
       JOIN usuarios u ON u.UsuarioId = pe.UsuarioId
       ORDER BY FIELD(x.Estado, 'Pendiente', 'Rechazado', 'Activo', 'Finalizado'), x.CreadoEn DESC`,
      estado === "todos" ? [] : [estado],
    );
    // deno-lint-ignore no-explicit-any
    return filas.map((f: any) => ({
      ...mapearContrato(f),
      empresa: { nombre: String(f.NombreEmpresa), nit: String(f.Nit ?? ""), email: String(f.EmpresaEmail ?? "") },
    }));
  },

  async rutaComprobante(contratoId: string): Promise<string | null> {
    const [c] = await conexion.query(
      `SELECT ComprobantePago FROM contratoscorporativos WHERE ContratoId = ? LIMIT 1`,
      [contratoId],
    );
    return c?.ComprobantePago ? String(c.ComprobantePago) : null;
  },

  // Aprueba el pago: activa el contrato y genera el código de vinculación
  async aprobar(contratoId: string) {
    const r = await conexion.transaction(async (conn) => {
      // deno-lint-ignore no-explicit-any
      const [c] = (await conn.query(
        `SELECT c.ContratoId, c.Estado, c.ComprobantePago, c.NumeroEmpleadosCubiertos, c.NumeroOrden,
                p.DuracionDias, pe.NombreEmpresa, pe.UsuarioId
         FROM contratoscorporativos c
         LEFT JOIN planes p ON p.PlanId = c.PlanId
         JOIN perfilempresa pe ON pe.PerfileId = c.EmpresaId
         WHERE c.ContratoId = ? FOR UPDATE`,
        [contratoId],
      )) as any[];
      if (!c) return { error: "No encontramos esta solicitud.", status: 404 };
      if (c.Estado !== "Pendiente") return { error: "Esta solicitud ya fue revisada.", status: 409 };
      if (!c.ComprobantePago) return { error: "La empresa todavía no ha subido el comprobante de pago.", status: 409 };
      const dias = Number(c.DuracionDias ?? 0);
      if (dias < 1) return { error: "El plan de esta solicitud ya no existe o no tiene vigencia.", status: 409 };

      await conn.execute(
        `UPDATE contratoscorporativos
         SET Estado = 'Activo', MotivoRechazo = NULL, FechaInicio = NOW(),
             FechaFin = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE ContratoId = ?`,
        [dias, contratoId],
      );

      // Código único: PREFIJO-XXXX
      const prefijo = prefijoCodigo(String(c.NombreEmpresa));
      let codigo = "";
      for (let i = 0; i < 10 && !codigo; i++) {
        const intento = `${prefijo}-${parteAzar()}`;
        // deno-lint-ignore no-explicit-any
        const [existe] = (await conn.query(`SELECT 1 FROM codigosvinculacion WHERE Codigo = ? LIMIT 1`, [intento])) as any[];
        if (!existe) codigo = intento;
      }
      if (!codigo) throw new Error("No se pudo generar un código único");
      await conn.execute(
        `INSERT INTO codigosvinculacion (CodigoId, ContratoId, Codigo, CupoMaximo, CupoUsado, CreadoEn)
         VALUES (?, ?, ?, ?, 0, NOW())`,
        [crypto.randomUUID(), contratoId, codigo, Number(c.NumeroEmpleadosCubiertos)],
      );
      return {
        ok: true as const,
        codigo,
        usuarioEmpresa: String(c.UsuarioId),
        numeroOrden: String(c.NumeroOrden),
      };
    });

    if ("ok" in r && r.usuarioEmpresa) {
      await notificar(
        r.usuarioEmpresa,
        "Tu plan empresarial está activo",
        `Confirmamos el pago de la orden ${r.numeroOrden}. Tu código para los trabajadores es ${r.codigo}.`,
      );
    }
    return r;
  },

  async rechazar(contratoId: string, motivo: string) {
    const [c] = await conexion.query(
      `SELECT c.Estado, c.NumeroOrden, pe.UsuarioId
       FROM contratoscorporativos c JOIN perfilempresa pe ON pe.PerfileId = c.EmpresaId
       WHERE c.ContratoId = ? LIMIT 1`,
      [contratoId],
    );
    if (!c) return { error: "No encontramos esta solicitud.", status: 404 };
    if (c.Estado !== "Pendiente") return { error: "Esta solicitud ya fue revisada.", status: 409 };
    await conexion.execute(
      `UPDATE contratoscorporativos SET Estado = 'Rechazado', MotivoRechazo = ? WHERE ContratoId = ?`,
      [motivo, contratoId],
    );
    await notificar(
      String(c.UsuarioId),
      "Revisa el pago de tu plan",
      `No pudimos confirmar el pago de la orden ${c.NumeroOrden}: ${motivo}. Puedes subir un nuevo comprobante en Mi beneficio.`,
    );
    return { ok: true as const };
  },
};
