// =====================================================================
// cambio: ARCHIVO NUEVO — Pagos del paciente con Wompi.
//
// Citas:
//   El paciente agenda sin pagar. Cuando el psicólogo ACEPTA la cita
//   (Estado = 'Confirmada'), el paciente puede pagarla con Wompi o con
//   una sesión de un paquete que haya comprado.
//   Se guarda en la tabla pagos (EstadoPago 'Pendiente' -> 'Completado'),
//   con la comisión de Psynex y el neto del psicólogo (Helpers/Pagos.ts).
//
// Paquetes:
//   Se guarda la compra en comprasplanes ('Pendiente' -> 'Activo').
//   Cada vez que se usa una sesión del paquete se suma SesionesUsadas.
//
// cambio: MODO MANUAL (temporal). Mientras no haya llaves de prueba de
// Wompi, el pago queda "en revisión" (Pasarela 'Manual') y el administrador
// lo acepta o rechaza en "Pagos de pacientes".
// =====================================================================
import { conexion } from "../conexion.ts";
import { calcularMontos, obtenerPorcentajeComision } from "../../Helpers/Pagos.ts";
import {
  aCentavos,
  consultarTransaccion,
  metodoDesdeWompi,
  modoPago,
  MONEDA,
  nuevaReferencia,
  urlCheckout,
} from "../../Helpers/Wompi.ts";
import { avisarAdmins } from "../../Helpers/AvisosAdmin.ts";

type Fila = Record<string, unknown>;
type Resultado<T> = T | { error: string; status: number };

const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// Perfil de paciente (PerfiluId) + datos para el checkout
async function paciente(usuarioId: string) {
  const [f] = await conexion.query(
    `SELECT pp.PerfiluId, u.NombreCompleto, u.Email
     FROM perfilpaciente pp JOIN usuarios u ON u.UsuarioId = pp.UsuarioId
     WHERE pp.UsuarioId = ? LIMIT 1`,
    [usuarioId],
  ) as Fila[];
  return f ? { perfilId: texto(f.PerfiluId), nombre: texto(f.NombreCompleto), email: texto(f.Email) } : null;
}

// Cita del paciente (solo el titular la paga) + precio del psicólogo
async function citaDelPaciente(perfilId: string, citaId: string) {
  const [f] = await conexion.query(
    `SELECT c.CitaId, c.Estado, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora, c.PacienteId, ps.PrecioPorHora, ps.UsuarioId AS PsicologoUsuarioId,
            u.NombreCompleto AS Psicologo,
            (SELECT COUNT(*) FROM pagos p WHERE p.CitaId = c.CitaId AND p.EstadoPago = 'Completado') AS Pagada
     FROM citas c
     JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
     JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
     WHERE c.CitaId = ? AND c.PacienteId = ? LIMIT 1`,
    [citaId, perfilId],
  ) as Fila[];
  return f ?? null;
}

async function idMetodoPago(nombre: string | null) {
  if (!nombre) return null;
  const [f] = await conexion.query(`SELECT MetodoPagoId FROM metodospago WHERE Nombre = ? LIMIT 1`, [nombre]) as Fila[];
  return f ? texto(f.MetodoPagoId) : null;
}

async function notificar(usuarioId: string, titulo: string, mensaje: string) {
  await conexion.execute(
    `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
     VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
    [crypto.randomUUID(), usuarioId, titulo, mensaje],
  );
}

export const PagosWompiModel = {
  // ------------------------------------------------------------------
  // Mis citas (reales) con su estado de pago
  // ------------------------------------------------------------------
  async citasPaciente(usuarioId: string) {
    const pac = await paciente(usuarioId);
    if (!pac) return [];
    const filas = await conexion.query(
      `SELECT c.CitaId, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora, c.DuracionMinutos, c.Modalidad, c.Formato, c.Estado,
              (c.PacienteId = ?) AS EsTitular,
              ps.PerfilId, ps.PrecioPorHora, u.NombreCompleto AS Psicologo,
              COALESCE(NULLIF(c.Direccion, ''), ps.Direccion) AS Direccion, c.Indicaciones, -- cambio: lugar (presencial)
              (ps.Foto IS NOT NULL AND ps.Foto LIKE 'data:image/%') AS TieneFoto,
              CRC32(ps.Foto) AS FotoVersion,
              (SELECT e.Titulo FROM estudios e WHERE e.PerfilId = ps.PerfilId
                ORDER BY e.EnCurso ASC, e.FechaGrado DESC LIMIT 1) AS Titulo,
              (SELECT p.Origen FROM pagos p WHERE p.CitaId = c.CitaId AND p.EstadoPago = 'Completado' LIMIT 1) AS PagoOrigen,
              (SELECT COUNT(*) FROM pagos p WHERE p.CitaId = c.CitaId AND p.EstadoPago = 'Pendiente' AND p.Pasarela = 'Manual') AS EnRevision,
              (SELECT COUNT(*) FROM calificacionescita cc WHERE cc.CitaId = c.CitaId AND cc.PacienteId = ?) AS Calificada
       FROM citas c
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       WHERE c.PacienteId = ?
          OR EXISTS (SELECT 1 FROM participantescita pc WHERE pc.CitaId = c.CitaId AND pc.PacienteId = ?)
       ORDER BY c.FechaHora DESC`,
      [pac.perfilId, pac.perfilId, pac.perfilId, pac.perfilId],
    ) as Fila[];

    return filas.map((f) => ({
      id: texto(f.CitaId),
      fechaHora: texto(f.FechaHora),
      duracion: Number(f.DuracionMinutos ?? 60),
      modalidad: texto(f.Modalidad) || "Virtual",
      formato: texto(f.Formato) || "Individual",
      estado: texto(f.Estado),
      esTitular: Number(f.EsTitular ?? 0) === 1,
      precio: Number(f.PrecioPorHora ?? 0),
      pago: f.PagoOrigen
        ? (texto(f.PagoOrigen) === "Paquete" ? "Paquete" : texto(f.PagoOrigen) === "Empresarial" ? "Empresa" : "Pagada")
        : Number(f.EnRevision ?? 0) > 0 ? "Revision" : "Pendiente",
      calificada: Number(f.Calificada ?? 0) > 0,
      direccion: texto(f.Direccion),
      indicaciones: texto(f.Indicaciones),
      psicologo: {
        id: texto(f.PerfilId),
        nombre: texto(f.Psicologo),
        titulo: texto(f.Titulo) || "Psicólogo/a",
        tieneFoto: Number(f.TieneFoto ?? 0) === 1,
        fotoVersion: f.FotoVersion === null || f.FotoVersion === undefined ? "" : texto(f.FotoVersion),
      },
    }));
  },

  // ------------------------------------------------------------------
  // Paquetes activos del paciente (con sesiones disponibles)
  // ------------------------------------------------------------------
  async paquetes(usuarioId: string) {
    const pac = await paciente(usuarioId);
    if (!pac) return [];
    const filas = await conexion.query(
      `SELECT cp.CompraId, cp.Precio, cp.SesionesTotales, cp.SesionesUsadas, cp.Estado,
              DATE_FORMAT(cp.FechaPago, '%Y-%m-%d %H:%i') AS FechaPago,
              DATE_FORMAT(cp.FechaVence, '%Y-%m-%d %H:%i') AS FechaVence, pl.Nombre
       FROM comprasplanes cp JOIN planes pl ON pl.PlanId = cp.PlanId
       WHERE cp.PacienteId = ?
         AND (cp.Estado = 'Activo' OR (cp.Estado = 'Pendiente' AND cp.MetodoPago = 'Manual'))
       ORDER BY cp.Estado = 'Pendiente' DESC, cp.FechaPago DESC`,
      [pac.perfilId],
    ) as Fila[];
    const hoy = new Date();
    return filas.map((f) => {
      const vence = f.FechaVence ? new Date(texto(f.FechaVence).replace(" ", "T")) : null;
      const totales = Number(f.SesionesTotales ?? 0);
      const usadas = Number(f.SesionesUsadas ?? 0);
      return {
        id: texto(f.CompraId),
        plan: texto(f.Nombre),
        precio: Number(f.Precio ?? 0),
        sesionesTotales: totales,
        sesionesUsadas: usadas,
        sesionesDisponibles: Math.max(0, totales - usadas),
        fechaPago: f.FechaPago ? texto(f.FechaPago) : null,
        fechaVence: f.FechaVence ? texto(f.FechaVence) : null,
        enRevision: texto(f.Estado) === "Pendiente",
        vigente: texto(f.Estado) === "Activo" && usadas < totales && (!vence || vence > hoy),
      };
    });
  },

  // ------------------------------------------------------------------
  // Historial de pagos del paciente (citas y paquetes)
  // ------------------------------------------------------------------
  async historial(usuarioId: string) {
    const pac = await paciente(usuarioId);
    if (!pac) return [];
    const citas = await conexion.query(
      `SELECT p.PagoId, p.Origen, p.MontoTotal, p.EstadoPago, DATE_FORMAT(COALESCE(p.FechaPago, p.CreadoEn), '%Y-%m-%d %H:%i') AS Fecha, p.ReferenciaPasarela, p.Pasarela,
              m.Nombre AS Metodo, u.NombreCompleto AS Psicologo, c.Formato
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       LEFT JOIN metodospago m ON m.MetodoPagoId = p.MetodoPagoId
       WHERE c.PacienteId = ? AND p.EstadoPago IN ('Completado', 'Rechazado', 'Reembolso', 'Reembolsado')`,
      [pac.perfilId],
    ) as Fila[];
    const compras = await conexion.query(
      `SELECT cp.CompraId, cp.Precio, cp.Estado, DATE_FORMAT(COALESCE(cp.FechaPago, cp.CreadoEn), '%Y-%m-%d %H:%i') AS Fecha, cp.Referencia, cp.MetodoPago, pl.Nombre
       FROM comprasplanes cp JOIN planes pl ON pl.PlanId = cp.PlanId
       WHERE cp.PacienteId = ? AND cp.Estado IN ('Activo', 'Rechazado')`,
      [pac.perfilId],
    ) as Fila[];

    const formato = (f: unknown) => texto(f) === "Pareja" ? "Terapia de pareja" : texto(f) === "Familiar" ? "Terapia familiar" : "Sesión individual";
    const lista = [
      ...citas.map((f) => ({
        id: texto(f.PagoId),
        tipo: "cita" as const,
        concepto: formato(f.Formato),
        detalle: texto(f.Psicologo),
        metodo: texto(f.Origen) === "Paquete" ? "Sesión de mi paquete"
          : texto(f.Origen) === "Empresarial" ? "Beneficio de mi empresa"
          : texto(f.Pasarela) === "Manual" ? "Confirmado por Psynex" : texto(f.Metodo) || "Wompi",
        valor: Number(f.MontoTotal ?? 0),
        // cambio: citas canceladas que se pagaron con dinero
        estado: texto(f.EstadoPago) === "Completado" ? "Aprobado"
          : texto(f.EstadoPago) === "Reembolso" ? "Por devolver"
          : texto(f.EstadoPago) === "Reembolsado" ? "Devuelto" : "Rechazado",
        fecha: texto(f.Fecha),
        referencia: texto(f.ReferenciaPasarela),
      })),
      ...compras.map((f) => ({
        id: texto(f.CompraId),
        tipo: "paquete" as const,
        concepto: `Paquete: ${texto(f.Nombre)}`,
        detalle: "Plan de sesiones",
        metodo: texto(f.MetodoPago) === "Manual" ? "Confirmado por Psynex" : metodoDesdeWompi(texto(f.MetodoPago)) ?? "Wompi",
        valor: Number(f.Precio ?? 0),
        estado: texto(f.Estado) === "Activo" ? "Aprobado" : "Rechazado",
        fecha: texto(f.Fecha),
        referencia: texto(f.Referencia),
      })),
    ];
    return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  },

  // ------------------------------------------------------------------
  // Preparar el pago de una cita confirmada -> URL del checkout
  // ------------------------------------------------------------------
  async pagarCita(usuarioId: string, citaId: string): Promise<Resultado<{ url: string | null; manual: boolean; referencia: string }>> {
    const pac = await paciente(usuarioId);
    if (!pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };
    const cita = await citaDelPaciente(pac.perfilId, citaId);
    if (!cita) return { error: "Cita no encontrada.", status: 404 };
    if (texto(cita.Estado) !== "Confirmada") {
      return { error: "Solo puedes pagar una cita cuando el psicólogo la haya aceptado.", status: 409 };
    }
    if (Number(cita.Pagada ?? 0) > 0) return { error: "Esta cita ya está pagada.", status: 409 };
    const precio = Number(cita.PrecioPorHora ?? 0);
    if (!(precio > 0)) return { error: "El psicólogo todavía no tiene un precio configurado.", status: 409 };

    const porcentaje = await obtenerPorcentajeComision();
    const m = calcularMontos(Math.round(precio), porcentaje);
    const referencia = nuevaReferencia("CITA");
    const manual = modoPago() === "manual";
    const pasarela = manual ? "Manual" : "Wompi";

    // Si ya había un intento pendiente se reutiliza la fila con una referencia nueva
    const [pendiente] = await conexion.query(
      `SELECT PagoId FROM pagos WHERE CitaId = ? AND EstadoPago = 'Pendiente' LIMIT 1`,
      [citaId],
    ) as Fila[];
    if (pendiente) {
      await conexion.execute(
        `UPDATE pagos SET MontoTotal = ?, MontoAnticipo = ?, MontoPendiente = 0, PorcentajeComision = ?,
                ComisionPsynex = ?, MontoNeto = ?, Pasarela = ?, ReferenciaPasarela = ?, TransaccionId = NULL
         WHERE PagoId = ?`,
        [m.montoTotal, m.montoTotal, m.porcentajeComision, m.comisionPsynex, m.montoNeto, pasarela, referencia, pendiente.PagoId],
      );
    } else {
      await conexion.execute(
        `INSERT INTO pagos
           (PagoId, CitaId, CompraId, MetodoPagoId, Origen, MontoTotal, MontoAnticipo, MontoPendiente,
            PorcentajeComision, ComisionPsynex, MontoNeto, EsGratuita, EstadoPago, EstadoTransferencia,
            Pasarela, ReferenciaPasarela, TransaccionId, FechaPago, CreadoEn)
         VALUES (?, ?, NULL, NULL, 'Individual', ?, ?, 0, ?, ?, ?, 0, 'Pendiente', 'Pendiente',
                 ?, ?, NULL, NULL, NOW())`,
        [crypto.randomUUID(), citaId, m.montoTotal, m.montoTotal, m.porcentajeComision, m.comisionPsynex, m.montoNeto, pasarela, referencia],
      );
    }

    // Modo manual: queda en revisión para que el administrador lo acepte
    // cambio: se le avisa al administrador (campanita + correo)
    if (manual) {
      avisarAdmins(
        "Nuevo pago por revisar",
        `${pac.nombre} envió el pago de una cita con ${texto(cita.Psicologo)} (${texto(cita.FechaHora)}) por $${m.montoTotal.toLocaleString("es-CO")}.`,
        "/Administrador/pagospacientes",
        {
          boton: "Revisar pago",
          detalles: [
            ["Paciente", `${pac.nombre} (${pac.email})`],
            ["Concepto", `Cita con ${texto(cita.Psicologo)}`],
            ["Fecha de la cita", texto(cita.FechaHora)],
            ["Valor", `$${m.montoTotal.toLocaleString("es-CO")}`],
            ["Referencia", referencia],
          ],
        },
      );
      return { url: null, manual: true, referencia };
    }

    const url = await urlCheckout({ referencia, centavos: aCentavos(m.montoTotal), email: pac.email, nombre: pac.nombre });
    return { url, manual: false, referencia };
  },

  // ------------------------------------------------------------------
  // Preparar la compra de un paquete -> URL del checkout
  // ------------------------------------------------------------------
  async comprarPlan(usuarioId: string, planId: string): Promise<Resultado<{ url: string | null; manual: boolean; referencia: string }>> {
    const pac = await paciente(usuarioId);
    if (!pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };
    const [plan] = await conexion.query(
      `SELECT PlanId, Nombre, Precio, CantidadSesiones FROM planes
       WHERE PlanId = ? AND Publicado = 1 AND Tipo = 'Individual' LIMIT 1`,
      [planId],
    ) as Fila[];
    if (!plan) return { error: "Ese plan no está disponible.", status: 404 };
    const precio = Math.round(Number(plan.Precio ?? 0));
    if (!(precio > 0)) return { error: "Ese plan no tiene un precio válido.", status: 409 };

    const manual = modoPago() === "manual";

    // Modo manual: si ya pidió este mismo plan y está en revisión, no se repite
    if (manual) {
      const [ya] = await conexion.query(
        `SELECT Referencia FROM comprasplanes
         WHERE PacienteId = ? AND PlanId = ? AND Estado = 'Pendiente' AND MetodoPago = 'Manual' LIMIT 1`,
        [pac.perfilId, planId],
      ) as Fila[];
      if (ya) return { url: null, manual: true, referencia: texto(ya.Referencia) };
    }

    const referencia = nuevaReferencia("PLAN");
    await conexion.execute(
      `INSERT INTO comprasplanes
         (CompraId, PacienteId, PlanId, Precio, SesionesTotales, SesionesUsadas, Estado, Referencia, MetodoPago, CreadoEn)
       VALUES (?, ?, ?, ?, ?, 0, 'Pendiente', ?, ?, NOW())`,
      [crypto.randomUUID(), pac.perfilId, planId, precio, Math.max(1, Number(plan.CantidadSesiones ?? 1)), referencia, manual ? "Manual" : null],
    );

    if (manual) {
      avisarAdmins(
        "Nuevo pago por revisar",
        `${pac.nombre} envió el pago del paquete ${texto(plan.Nombre)} por $${precio.toLocaleString("es-CO")}.`,
        "/Administrador/pagospacientes",
        {
          boton: "Revisar pago",
          detalles: [
            ["Paciente", `${pac.nombre} (${pac.email})`],
            ["Concepto", `Paquete ${texto(plan.Nombre)}`],
            ["Sesiones", String(Math.max(1, Number(plan.CantidadSesiones ?? 1)))],
            ["Valor", `$${precio.toLocaleString("es-CO")}`],
            ["Referencia", referencia],
          ],
        },
      );
      return { url: null, manual: true, referencia };
    }

    const url = await urlCheckout({ referencia, centavos: aCentavos(precio), email: pac.email, nombre: pac.nombre });
    return { url, manual: false, referencia };
  },

  // ------------------------------------------------------------------
  // Confirmar una transacción consultándola a Wompi.
  // Lo usan la página de regreso (con el usuario) y el webhook (sin usuario).
  // Es "idempotente": si ya estaba aprobada no hace nada otra vez.
  // ------------------------------------------------------------------
  async confirmar(transaccionId: string, usuarioId: string | null) {
    const tx = await consultarTransaccion(transaccionId);
    if (!tx) return { error: "No encontramos esa transacción en Wompi.", status: 404 };

    const estado = tx.status === "APPROVED" ? "Aprobado"
      : tx.status === "PENDING" ? "Pendiente"
      : "Rechazado";
    const metodoNombre = metodoDesdeWompi(tx.payment_method_type);

    // ¿De quién es? (si viene el usuario, solo puede confirmar lo suyo)
    const pac = usuarioId ? await paciente(usuarioId) : null;
    if (usuarioId && !pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };

    // ---------- Pago de una cita ----------
    if (tx.reference.startsWith("CITA-")) {
      const [p] = await conexion.query(
        `SELECT p.PagoId, p.MontoTotal, p.EstadoPago, c.CitaId, c.PacienteId, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora,
                ps.UsuarioId AS PsicologoUsuarioId, u.NombreCompleto AS Psicologo,
                (SELECT up.NombreCompleto FROM perfilpaciente pp JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
                  WHERE pp.PerfiluId = c.PacienteId LIMIT 1) AS Paciente
         FROM pagos p
         JOIN citas c ON c.CitaId = p.CitaId
         JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
         JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
         WHERE p.ReferenciaPasarela = ? LIMIT 1`,
        [tx.reference],
      ) as Fila[];
      if (!p) return { error: "No encontramos el pago de esa transacción.", status: 404 };
      if (pac && texto(p.PacienteId) !== pac.perfilId) return { error: "Ese pago no es tuyo.", status: 403 };

      // El monto y la moneda deben ser exactamente los que se cobraron
      if (tx.currency !== MONEDA || tx.amount_in_cents !== aCentavos(Number(p.MontoTotal))) {
        console.error("Wompi: el monto no coincide", tx.reference, tx.amount_in_cents);
        return { error: "El monto pagado no coincide con el valor de la cita.", status: 409 };
      }

      const base = { tipo: "cita" as const, estado, valor: Number(p.MontoTotal), detalle: `Cita con ${texto(p.Psicologo)}`, metodo: metodoNombre, referencia: tx.reference };
      if (texto(p.EstadoPago) === "Completado") return { ...base, estado: "Aprobado" };

      if (estado === "Aprobado") {
        const r = await conexion.execute(
          `UPDATE pagos SET EstadoPago = 'Completado', FechaPago = NOW(), TransaccionId = ?, MetodoPagoId = ?
           WHERE PagoId = ? AND EstadoPago <> 'Completado'`,
          [tx.id, await idMetodoPago(metodoNombre), p.PagoId],
        );
        if ((r.affectedRows ?? 0) > 0) {
          await notificar(
            texto(p.PsicologoUsuarioId),
            "Pago recibido",
            `${texto(p.Paciente) || "Tu paciente"} pagó la cita del ${texto(p.FechaHora)}.`,
          );
        }
      } else if (estado === "Rechazado") {
        await conexion.execute(
          `UPDATE pagos SET EstadoPago = 'Rechazado', TransaccionId = ? WHERE PagoId = ? AND EstadoPago = 'Pendiente'`,
          [tx.id, p.PagoId],
        );
      }
      return base;
    }

    // ---------- Compra de un paquete ----------
    if (tx.reference.startsWith("PLAN-")) {
      const [cp] = await conexion.query(
        `SELECT cp.CompraId, cp.PacienteId, cp.Precio, cp.Estado, pl.Nombre, pl.DuracionDias
         FROM comprasplanes cp JOIN planes pl ON pl.PlanId = cp.PlanId
         WHERE cp.Referencia = ? LIMIT 1`,
        [tx.reference],
      ) as Fila[];
      if (!cp) return { error: "No encontramos la compra de esa transacción.", status: 404 };
      if (pac && texto(cp.PacienteId) !== pac.perfilId) return { error: "Esa compra no es tuya.", status: 403 };
      if (tx.currency !== MONEDA || tx.amount_in_cents !== aCentavos(Number(cp.Precio))) {
        console.error("Wompi: el monto no coincide", tx.reference, tx.amount_in_cents);
        return { error: "El monto pagado no coincide con el valor del paquete.", status: 409 };
      }

      const base = { tipo: "paquete" as const, estado, valor: Number(cp.Precio), detalle: `Paquete ${texto(cp.Nombre)}`, metodo: metodoNombre, referencia: tx.reference };
      if (texto(cp.Estado) === "Activo") return { ...base, estado: "Aprobado" };

      if (estado === "Aprobado") {
        const dias = Number(cp.DuracionDias ?? 0);
        await conexion.execute(
          `UPDATE comprasplanes
           SET Estado = 'Activo', FechaPago = NOW(), TransaccionId = ?, MetodoPago = ?,
               FechaVence = ${dias > 0 ? "DATE_ADD(NOW(), INTERVAL ? DAY)" : "NULL"}
           WHERE CompraId = ? AND Estado <> 'Activo'`,
          dias > 0 ? [tx.id, tx.payment_method_type ?? null, dias, cp.CompraId] : [tx.id, tx.payment_method_type ?? null, cp.CompraId],
        );
      } else if (estado === "Rechazado") {
        await conexion.execute(
          `UPDATE comprasplanes SET Estado = 'Rechazado', TransaccionId = ? WHERE CompraId = ? AND Estado = 'Pendiente'`,
          [tx.id, cp.CompraId],
        );
      }
      return base;
    }

    return { error: "Esa transacción no es de Psynex.", status: 404 };
  },

  // ------------------------------------------------------------------
  // Pagar una cita confirmada con una sesión de un paquete activo
  // ------------------------------------------------------------------
  async usarPaquete(usuarioId: string, citaId: string): Promise<Resultado<{ plan: string; sesionesDisponibles: number }>> {
    const pac = await paciente(usuarioId);
    if (!pac) return { error: "No encontramos tu perfil de paciente.", status: 404 };
    const cita = await citaDelPaciente(pac.perfilId, citaId);
    if (!cita) return { error: "Cita no encontrada.", status: 404 };
    if (texto(cita.Estado) !== "Confirmada") {
      return { error: "Solo puedes usar tu paquete cuando el psicólogo haya aceptado la cita.", status: 409 };
    }
    if (Number(cita.Pagada ?? 0) > 0) return { error: "Esta cita ya está pagada.", status: 409 };

    const porcentaje = await obtenerPorcentajeComision();

    return await conexion.transaction(async (conn) => {
      const [cp] = await conn.query(
        `SELECT cp.CompraId, cp.Precio, cp.SesionesTotales, cp.SesionesUsadas, pl.Nombre
         FROM comprasplanes cp JOIN planes pl ON pl.PlanId = cp.PlanId
         WHERE cp.PacienteId = ? AND cp.Estado = 'Activo'
           AND cp.SesionesUsadas < cp.SesionesTotales
           AND (cp.FechaVence IS NULL OR cp.FechaVence > NOW())
         ORDER BY cp.FechaVence IS NULL, cp.FechaVence ASC
         LIMIT 1 FOR UPDATE`,
        [pac.perfilId],
      ) as Fila[];
      if (!cp) return { error: "No tienes un paquete activo con sesiones disponibles.", status: 409 };

      // Valor de una sesión del paquete (para el neto del psicólogo)
      const valorSesion = Math.round(Number(cp.Precio) / Math.max(1, Number(cp.SesionesTotales)));
      const m = calcularMontos(valorSesion, porcentaje);

      await conn.execute(`UPDATE comprasplanes SET SesionesUsadas = SesionesUsadas + 1 WHERE CompraId = ?`, [cp.CompraId]);
      await conn.execute(`DELETE FROM pagos WHERE CitaId = ? AND EstadoPago = 'Pendiente'`, [citaId]);
      await conn.execute(
        `INSERT INTO pagos
           (PagoId, CitaId, CompraId, MetodoPagoId, Origen, MontoTotal, MontoAnticipo, MontoPendiente,
            PorcentajeComision, ComisionPsynex, MontoNeto, EsGratuita, EstadoPago, EstadoTransferencia,
            Pasarela, ReferenciaPasarela, TransaccionId, FechaPago, CreadoEn)
         VALUES (?, ?, ?, NULL, 'Paquete', ?, ?, 0, ?, ?, ?, 0, 'Completado', 'Pendiente',
                 NULL, NULL, NULL, NOW(), NOW())`,
        [crypto.randomUUID(), citaId, cp.CompraId, m.montoTotal, m.montoTotal, m.porcentajeComision, m.comisionPsynex, m.montoNeto],
      );
      await conn.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', 'Pago recibido', ?, 0, NOW())`,
        [crypto.randomUUID(), cita.PsicologoUsuarioId, `${pac.nombre} pagó la cita del ${texto(cita.FechaHora)} con su paquete.`],
      );
      return { plan: texto(cp.Nombre), sesionesDisponibles: Number(cp.SesionesTotales) - Number(cp.SesionesUsadas) - 1 };
    });
  },

  // ==================================================================
  // cambio: ADMINISTRADOR — pagos en revisión (modo manual temporal)
  // ==================================================================
  async pendientesAdmin() {
    const porRevisar = (e: string) => e === "Pendiente" || e === "Reembolso";
    const citas = await conexion.query(
      `SELECT p.PagoId, p.MontoTotal, p.EstadoPago, p.ReferenciaPasarela,
              DATE_FORMAT(p.CreadoEn, '%Y-%m-%d %H:%i') AS Solicitado,
              DATE_FORMAT(p.FechaPago, '%Y-%m-%d %H:%i') AS FechaPago,
              DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaCita, c.Modalidad, c.Formato,
              up.NombreCompleto AS Paciente, up.Email AS PacienteEmail, u.NombreCompleto AS Psicologo
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       WHERE p.Pasarela = 'Manual' OR p.EstadoPago IN ('Reembolso', 'Reembolsado') -- cambio: devoluciones por citas canceladas
       ORDER BY p.EstadoPago IN ('Pendiente', 'Reembolso') DESC, p.CreadoEn DESC
       LIMIT 100`,
    ) as Fila[];
    const compras = await conexion.query(
      `SELECT cp.CompraId, cp.Precio, cp.Estado, cp.Referencia, cp.SesionesTotales,
              DATE_FORMAT(cp.CreadoEn, '%Y-%m-%d %H:%i') AS Solicitado,
              DATE_FORMAT(cp.FechaPago, '%Y-%m-%d %H:%i') AS FechaPago,
              pl.Nombre AS Plan, up.NombreCompleto AS Paciente, up.Email AS PacienteEmail
       FROM comprasplanes cp
       JOIN planes pl ON pl.PlanId = cp.PlanId
       JOIN perfilpaciente pp ON pp.PerfiluId = cp.PacienteId
       JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
       WHERE cp.MetodoPago = 'Manual'
       ORDER BY cp.Estado = 'Pendiente' DESC, cp.CreadoEn DESC
       LIMIT 100`,
    ) as Fila[];

    // cambio: "Reembolso" = el paciente canceló una cita pagada y hay que devolverle el dinero
    const estadoDe = (e: string) =>
      ["Pendiente", "Rechazado", "Reembolso", "Reembolsado"].includes(e) ? e : "Aprobado";
    return [
      ...citas.map((f) => ({
        id: texto(f.PagoId),
        tipo: "cita" as const,
        estado: estadoDe(texto(f.EstadoPago)),
        valor: Number(f.MontoTotal ?? 0),
        referencia: texto(f.ReferenciaPasarela),
        solicitado: texto(f.Solicitado),
        fechaPago: f.FechaPago ? texto(f.FechaPago) : null,
        paciente: { nombre: texto(f.Paciente), email: texto(f.PacienteEmail) },
        concepto: `Cita ${texto(f.Formato) === "Individual" ? "individual" : texto(f.Formato).toLowerCase()} · ${texto(f.Modalidad).toLowerCase()}`,
        detalle: `Con ${texto(f.Psicologo)} · ${texto(f.FechaCita)}`,
      })),
      ...compras.map((f) => ({
        id: texto(f.CompraId),
        tipo: "paquete" as const,
        estado: estadoDe(texto(f.Estado)),
        valor: Number(f.Precio ?? 0),
        referencia: texto(f.Referencia),
        solicitado: texto(f.Solicitado),
        fechaPago: f.FechaPago ? texto(f.FechaPago) : null,
        paciente: { nombre: texto(f.Paciente), email: texto(f.PacienteEmail) },
        concepto: `Paquete ${texto(f.Plan)}`,
        detalle: `${Number(f.SesionesTotales ?? 0)} sesiones`,
      })),
    ].sort((a, b) => (porRevisar(a.estado) ? 0 : 1) - (porRevisar(b.estado) ? 0 : 1) || b.solicitado.localeCompare(a.solicitado));
  },

  // Aceptar o rechazar el pago de una cita
  async decidirCitaAdmin(pagoId: string, aprobar: boolean, motivo = ""): Promise<Resultado<{ estado: string }>> {
    const [p] = await conexion.query(
      `SELECT p.PagoId, p.EstadoPago, DATE_FORMAT(c.FechaHora, '%Y-%m-%d %H:%i') AS FechaHora,
              pp.UsuarioId AS PacienteUsuarioId, up.NombreCompleto AS Paciente,
              ps.UsuarioId AS PsicologoUsuarioId, u.NombreCompleto AS Psicologo
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       JOIN perfilpaciente pp ON pp.PerfiluId = c.PacienteId
       JOIN usuarios up ON up.UsuarioId = pp.UsuarioId
       JOIN perfilpsicologo ps ON ps.PerfilId = c.PsicologoId
       JOIN usuarios u ON u.UsuarioId = ps.UsuarioId
       WHERE p.PagoId = ? AND (p.Pasarela = 'Manual' OR p.EstadoPago = 'Reembolso') LIMIT 1`,
      [pagoId],
    ) as Fila[];
    if (!p) return { error: "Pago no encontrado.", status: 404 };

    // cambio: devolución de una cita cancelada -> el admin marca que ya devolvió el dinero
    if (texto(p.EstadoPago) === "Reembolso") {
      if (!aprobar) return { error: "Este pago está esperando la devolución del dinero.", status: 409 };
      await conexion.execute(
        `UPDATE pagos SET EstadoPago = 'Reembolsado' WHERE PagoId = ? AND EstadoPago = 'Reembolso'`,
        [pagoId],
      );
      await notificar(texto(p.PacienteUsuarioId), "Dinero devuelto",
        `Te devolvimos el dinero de la cita cancelada con ${texto(p.Psicologo)} del ${texto(p.FechaHora)}.`);
      return { estado: "Reembolsado" };
    }
    if (texto(p.EstadoPago) !== "Pendiente") return { error: "Ese pago ya fue revisado.", status: 409 };

    if (aprobar) {
      await conexion.execute(
        `UPDATE pagos SET EstadoPago = 'Completado', FechaPago = NOW() WHERE PagoId = ? AND EstadoPago = 'Pendiente'`,
        [pagoId],
      );
      await notificar(texto(p.PacienteUsuarioId), "Pago aprobado",
        `Tu pago de la cita con ${texto(p.Psicologo)} del ${texto(p.FechaHora)} fue aprobado. Ya puedes entrar a tu sesión.`);
      await notificar(texto(p.PsicologoUsuarioId), "Pago recibido",
        `${texto(p.Paciente) || "Tu paciente"} pagó la cita del ${texto(p.FechaHora)}.`);
      return { estado: "Aprobado" };
    }

    await conexion.execute(
      `UPDATE pagos SET EstadoPago = 'Rechazado' WHERE PagoId = ? AND EstadoPago = 'Pendiente'`,
      [pagoId],
    );
    await notificar(texto(p.PacienteUsuarioId), "Pago no aprobado",
      `No pudimos aprobar el pago de tu cita del ${texto(p.FechaHora)}.${motivo ? ` Motivo: ${motivo}` : ""} Puedes intentarlo de nuevo desde Mis citas.`);
    return { estado: "Rechazado" };
  },

  // Aceptar o rechazar la compra de un paquete
  async decidirCompraAdmin(compraId: string, aprobar: boolean, motivo = ""): Promise<Resultado<{ estado: string }>> {
    const [cp] = await conexion.query(
      `SELECT cp.CompraId, cp.Estado, pl.Nombre, pl.DuracionDias, pp.UsuarioId AS PacienteUsuarioId
       FROM comprasplanes cp
       JOIN planes pl ON pl.PlanId = cp.PlanId
       JOIN perfilpaciente pp ON pp.PerfiluId = cp.PacienteId
       WHERE cp.CompraId = ? AND cp.MetodoPago = 'Manual' LIMIT 1`,
      [compraId],
    ) as Fila[];
    if (!cp) return { error: "Compra no encontrada.", status: 404 };
    if (texto(cp.Estado) !== "Pendiente") return { error: "Esa compra ya fue revisada.", status: 409 };

    if (aprobar) {
      const dias = Number(cp.DuracionDias ?? 0);
      await conexion.execute(
        `UPDATE comprasplanes
         SET Estado = 'Activo', FechaPago = NOW(),
             FechaVence = ${dias > 0 ? "DATE_ADD(NOW(), INTERVAL ? DAY)" : "NULL"}
         WHERE CompraId = ? AND Estado = 'Pendiente'`,
        dias > 0 ? [dias, compraId] : [compraId],
      );
      await notificar(texto(cp.PacienteUsuarioId), "Paquete activo",
        `Tu paquete ${texto(cp.Nombre)} ya está activo. Úsalo cuando el psicólogo acepte tus citas.`);
      return { estado: "Aprobado" };
    }

    await conexion.execute(
      `UPDATE comprasplanes SET Estado = 'Rechazado' WHERE CompraId = ? AND Estado = 'Pendiente'`,
      [compraId],
    );
    await notificar(texto(cp.PacienteUsuarioId), "Pago no aprobado",
      `No pudimos aprobar el pago de tu paquete ${texto(cp.Nombre)}.${motivo ? ` Motivo: ${motivo}` : ""}`);
    return { estado: "Rechazado" };
  },
};
