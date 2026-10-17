// =====================================================================
// Fechas en hora de Colombia (America/Bogota, UTC-5 todo el año).
//
// En la base de datos las fechas (DATETIME) se guardan en hora local de
// Colombia. Para no depender de la zona horaria del computador donde
// corra Deno, aquí se trabaja con TEXTO "AAAA-MM-DD" y "HH:MM", y para
// comparar se convierten a minutos con Date.UTC (siempre en la misma
// "zona", así las cuentas cuadran).
// =====================================================================

const ZONA = "America/Bogota";

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

// Fecha y hora actuales en Colombia: { fecha: "2026-10-14", hora: "21:30" }
export function ahoraColombia(): { fecha: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

// "2026-10-14" + "09:30" -> minutos (para comparar y sumar fácilmente)
export function aMinutos(fecha: string, hora = "00:00"): number {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  return Date.UTC(a, m - 1, d, h, mi) / 60000;
}

// minutos -> { fecha: "AAAA-MM-DD", hora: "HH:MM" }
export function desdeMinutos(minutos: number): { fecha: string; hora: string } {
  const iso = new Date(minutos * 60000).toISOString(); // 2026-10-14T09:30:00.000Z
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

// Suma días a una fecha "AAAA-MM-DD"
export function sumarDias(fecha: string, dias: number): string {
  return desdeMinutos(aMinutos(fecha) + dias * 24 * 60).fecha;
}

// "2026-10-14" -> "Miercoles" (sin tilde, igual que en disponibilidadpsicologo)
export function diaSemana(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

// "08:00:00" o "08:00" -> "08:00"
export const horaCorta = (h: string) => String(h).slice(0, 5);
