import { conexion } from "../conexion.ts";

// Textos exactos que usa la base de datos. Si en tu aplicación se llaman distinto, cámbialos aquí.
const ESTADO_CITA_CANCELADA = "Cancelada";
const ESTADO_PAGO_PAGADO = "Pagado";
const TIPOS_CITA = ["Individual", "Empresarial", "Recompensa"] as const;

const MESES_ABREVIADOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Mes {
  clave: string;    // "2026-06"
  etiqueta: string; // "Jun 2026"
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

// Los últimos `cantidad` meses; el último es el mes actual.
function ultimosMeses(cantidad: number, ahora: Date): Mes[] {
  const meses: Mes[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push({
      clave: `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}`,
      etiqueta: `${MESES_ABREVIADOS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return meses;
}

// Rango de fechas para las consultas: desde el día 1 del primer mes hasta el día 1 del mes siguiente.
function rango(meses: Mes[], ahora: Date) {
  const siguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return {
    desde: `${meses[0].clave}-01 00:00:00`,
    hasta: `${siguiente.getFullYear()}-${dosDigitos(siguiente.getMonth() + 1)}-01 00:00:00`,
  };
}

// Cambio porcentual frente al período anterior. Devuelve null si no se puede calcular
// (no hay dato o el período anterior fue 0), para que la vista muestre "—" en vez de dividir por cero.
function cambioPorcentual(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

// Convierte las filas { mes, total } en un mapa para consultarlo por mes.
function aMapa(filas: Array<Record<string, unknown>>, campo = "total") {
  const mapa = new Map<string, number>();
  for (const f of filas) mapa.set(String(f.mes), Number(f[campo]));
  return mapa;
}

export const EstadisticasModel = {
  // Todo lo que necesita la vista de Estadísticas en una sola respuesta.
  // Definiciones: "citas" = citas que no están canceladas; los ingresos son los pagos
  // con estado "Pagado" y no gratuitos, sumando MontoTotal.
  async obtener(cantidadMeses: number) {
    const ahora = new Date();
    const lista = ultimosMeses(cantidadMeses, ahora);
    const { desde, hasta } = rango(lista, ahora);
    const ultimo = lista.length - 1;

    // 1. Citas por mes
    const citasRows = await conexion.query(
      `SELECT DATE_FORMAT(FechaHora, '%Y-%m') AS mes, COUNT(*) AS total
       FROM citas
       WHERE FechaHora >= ? AND FechaHora < ? AND Estado <> ?
       GROUP BY DATE_FORMAT(FechaHora, '%Y-%m')`,
      [desde, hasta, ESTADO_CITA_CANCELADA],
    );
    const citasMapa = aMapa(citasRows);

    // 2. Cancelaciones por mes (por fecha de cancelación; si no se guardó, por fecha de la cita)
    const cancelRows = await conexion.query(
      `SELECT DATE_FORMAT(COALESCE(CanceladaEn, FechaHora), '%Y-%m') AS mes, COUNT(*) AS total
       FROM citas
       WHERE Estado = ?
         AND COALESCE(CanceladaEn, FechaHora) >= ?
         AND COALESCE(CanceladaEn, FechaHora) < ?
       GROUP BY DATE_FORMAT(COALESCE(CanceladaEn, FechaHora), '%Y-%m')`,
      [ESTADO_CITA_CANCELADA, desde, hasta],
    );
    const cancelMapa = aMapa(cancelRows);

    // 3. Citas por tipo en todo el período
    const tipoRows = await conexion.query(
      `SELECT TipoCita, COUNT(*) AS total
       FROM citas
       WHERE FechaHora >= ? AND FechaHora < ? AND Estado <> ?
       GROUP BY TipoCita`,
      [desde, hasta, ESTADO_CITA_CANCELADA],
    );

    // 4. Ingresos por mes y por tipo de cita (solo pagos pagados y no gratuitos)
    const ingresosRows = await conexion.query(
      `SELECT DATE_FORMAT(p.FechaPago, '%Y-%m') AS mes, c.TipoCita AS tipo, SUM(p.MontoTotal) AS total
       FROM pagos p
       JOIN citas c ON c.CitaId = p.CitaId
       WHERE p.EstadoPago = ? AND p.EsGratuita = 0
         AND p.FechaPago >= ? AND p.FechaPago < ?
       GROUP BY DATE_FORMAT(p.FechaPago, '%Y-%m'), c.TipoCita`,
      [ESTADO_PAGO_PAGADO, desde, hasta],
    );

    // 5. Calificación promedio por mes
    const calRows = await conexion.query(
      `SELECT DATE_FORMAT(CreadoEn, '%Y-%m') AS mes, AVG(Puntaje) AS promedio, COUNT(*) AS cantidad
       FROM calificacionescita
       WHERE CreadoEn >= ? AND CreadoEn < ?
       GROUP BY DATE_FORMAT(CreadoEn, '%Y-%m')`,
      [desde, hasta],
    );
    const calMapa = new Map<string, number>();
    for (const f of calRows) calMapa.set(String(f.mes), Math.round(Number(f.promedio) * 10) / 10);

    // ---- Series para las gráficas ----
    const citasPorMes = lista.map((m) => ({
      mes: m.clave,
      etiqueta: m.etiqueta,
      total: citasMapa.get(m.clave) ?? 0,
    }));

    const totalPorTipo = new Map<string, number>();
    for (const f of tipoRows) totalPorTipo.set(String(f.TipoCita), Number(f.total));
    const totalCitasPeriodo = TIPOS_CITA.reduce((s, t) => s + (totalPorTipo.get(t) ?? 0), 0);
    const citasPorTipo = TIPOS_CITA.map((tipo) => {
      const total = totalPorTipo.get(tipo) ?? 0;
      return {
        tipo,
        total,
        porcentaje: totalCitasPeriodo > 0 ? Math.round((total / totalCitasPeriodo) * 100) : 0,
      };
    });

    const ingresosPorFuente = lista.map((m) => {
      const delMes = ingresosRows.filter((f: Record<string, unknown>) => String(f.mes) === m.clave);
      const suma = (tipo?: string) =>
        delMes
          .filter((f: Record<string, unknown>) => !tipo || f.tipo === tipo)
          .reduce((s: number, f: Record<string, unknown>) => s + Number(f.total), 0);
      return {
        mes: m.clave,
        etiqueta: m.etiqueta,
        individuales: suma("Individual"),
        empresariales: suma("Empresarial"),
        total: suma(),
      };
    });

    // ---- Tarjetas: mes actual frente al mes anterior ----
    const kpi = (serie: Array<number | null>) => ({
      valor: serie[ultimo],
      anterior: serie[ultimo - 1],
      cambioPct: cambioPorcentual(serie[ultimo], serie[ultimo - 1]),
    });

    return {
      periodo: { meses: cantidadMeses, desde, hasta },
      kpis: {
        citas: kpi(citasPorMes.map((x) => x.total)),
        ingresos: kpi(ingresosPorFuente.map((x) => x.total)),
        // null = todavía no hay calificaciones ese mes (la vista muestra "Sin datos")
        calificacion: kpi(lista.map((m) => calMapa.get(m.clave) ?? null)),
        cancelaciones: kpi(lista.map((m) => cancelMapa.get(m.clave) ?? 0)),
      },
      citasPorMes,
      citasPorTipo,
      ingresosPorFuente,
    };
  },
};