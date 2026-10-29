// =====================================================================
// cambio: ARCHIVO NUEVO — Pasarela de pagos Wompi (Web Checkout).
//
// Las llaves NO van en el código: se leen del archivo .env
//   WOMPI_PUBLIC_KEY        -> llave pública (pub_test_... en pruebas)
//   WOMPI_INTEGRITY_SECRET  -> secreto de integridad (firma del checkout)
//   WOMPI_EVENTS_SECRET     -> secreto de eventos (para validar el webhook)
//   WOMPI_API_URL           -> https://sandbox.wompi.co/v1 en pruebas
//
// Cómo funciona:
// 1. El backend arma la URL del checkout con la firma de integridad
//    (SHA-256 de referencia + monto en centavos + moneda + secreto).
// 2. El paciente paga en la página de Wompi y vuelve a Psynex con ?id=...
// 3. El backend le pregunta a Wompi por esa transacción (no se confía en
//    lo que diga el navegador) y revisa que la referencia y el monto
//    coincidan con lo que se cobró.
// =====================================================================

export const MONEDA = "COP";
const CHECKOUT_URL = "https://checkout.wompi.co/p/";

export function configWompi() {
  return {
    publicKey: Deno.env.get("WOMPI_PUBLIC_KEY") ?? "",
    integridad: Deno.env.get("WOMPI_INTEGRITY_SECRET") ?? "",
    eventos: Deno.env.get("WOMPI_EVENTS_SECRET") ?? "",
    api: (Deno.env.get("WOMPI_API_URL") ?? "https://sandbox.wompi.co/v1").replace(/\/+$/, ""),
    frontend: Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321",
  };
}

// ¿Están las llaves necesarias para cobrar con Wompi?
// cambio: PROTECCIÓN — solo se aceptan llaves de PRUEBA (pub_test_). Las de
// producción (pub_prod_) cobran plata real; para usarlas hay que escribir a
// propósito WOMPI_PERMITIR_PRODUCCION=true en el .env.
// Si no hay llaves válidas, los pagos quedan "en revisión" y el administrador
// los acepta a mano (modo temporal).
export const wompiConfigurado = () => {
  const c = configWompi();
  if (c.publicKey === "" || c.integridad === "") return false;
  if (c.publicKey.startsWith("pub_test_")) return true;
  const permitir = (Deno.env.get("WOMPI_PERMITIR_PRODUCCION") ?? "").toLowerCase() === "true";
  if (!permitir) console.warn("Wompi: hay una llave que no es de pruebas (pub_test_). Se usa el modo de pago manual.");
  return permitir;
};

export type ModoPago = "wompi" | "manual";
export const modoPago = (): ModoPago => (wompiConfigurado() ? "wompi" : "manual");

export async function sha256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Referencia única de cada intento de pago: "CITA-1730000000000-ab12cd34"
export const nuevaReferencia = (prefijo: "CITA" | "PLAN") =>
  `${prefijo}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

// Pesos -> centavos (Wompi trabaja en centavos y sin decimales)
export const aCentavos = (pesos: number) => Math.round(pesos) * 100;

// URL del Web Checkout de Wompi, ya firmada
export async function urlCheckout(datos: {
  referencia: string;
  centavos: number;
  email?: string;
  nombre?: string;
}) {
  const c = configWompi();
  const firma = await sha256(`${datos.referencia}${datos.centavos}${MONEDA}${c.integridad}`);
  const params = new URLSearchParams({
    "public-key": c.publicKey,
    "currency": MONEDA,
    "amount-in-cents": String(datos.centavos),
    "reference": datos.referencia,
    "signature:integrity": firma,
    "redirect-url": `${c.frontend}/Paciente/PagoResultado`,
  });
  if (datos.email) params.set("customer-data:email", datos.email);
  if (datos.nombre) params.set("customer-data:full-name", datos.nombre);
  return `${CHECKOUT_URL}?${params.toString()}`;
}

export interface TransaccionWompi {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING" | string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

// Consulta una transacción directamente a Wompi (ruta pública de su API)
export async function consultarTransaccion(id: string): Promise<TransaccionWompi | null> {
  const c = configWompi();
  try {
    const res = await fetch(`${c.api}/transactions/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as TransaccionWompi | null;
  } catch (e) {
    console.error("No se pudo consultar la transacción en Wompi:", e);
    return null;
  }
}

// Valida la firma de un evento (webhook) de Wompi:
// SHA-256 de los valores de signature.properties (en orden) + timestamp + secreto de eventos
export async function eventoValido(evento: Record<string, unknown>): Promise<boolean> {
  const secreto = configWompi().eventos;
  const firma = evento?.signature as { properties?: string[]; checksum?: string } | undefined;
  if (!secreto || !firma?.properties || !firma.checksum) return false;

  const datos = (evento.data ?? {}) as Record<string, unknown>;
  const valor = (ruta: string) =>
    ruta.split(".").reduce<unknown>((obj, k) => (obj as Record<string, unknown> | undefined)?.[k], datos);

  const cadena = firma.properties.map((p) => String(valor(p) ?? "")).join("") + String(evento.timestamp ?? "") + secreto;
  return (await sha256(cadena)) === String(firma.checksum).toLowerCase();
}

// Nombre del método de pago como está en la tabla metodospago
export function metodoDesdeWompi(tipo?: string): string | null {
  switch ((tipo ?? "").toUpperCase()) {
    case "CARD": return "Tarjeta de crédito / débito";
    case "PSE": return "PSE";
    case "NEQUI": return "Nequi";
    case "DAVIPLATA": return "Daviplata";
    case "BANCOLOMBIA_TRANSFER": return "Transferencia bancaria";
    default: return null;
  }
}
