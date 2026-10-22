import { conexion } from "../Model/conexion.ts";

// ---------------------------------------------------------------------
// Reglas de dinero de Psynex (RF-155, RF-156, RF-166, RF-167).
//
// Todo el dinero entra a Psynex. De cada cita pagada, Psynex retiene un
// porcentaje (comisión) y el resto es del psicólogo (monto neto).
// El porcentaje vive en configuracionplataforma (clave ComisionPorcentaje)
// y se guarda en cada pago (PorcentajeComision), así un cambio futuro no
// altera los pagos que ya se hicieron.
//
// Este helper lo usará el webhook de Wompi cuando se integre la pasarela.
// ---------------------------------------------------------------------

export const PORCENTAJE_COMISION_POR_DEFECTO = 30;

// Porcentaje vigente (ej. 30). Si no está configurado, usa el valor por defecto.
export async function obtenerPorcentajeComision(): Promise<number> {
  const rows = await conexion.query(
    `SELECT Valor FROM configuracionplataforma WHERE Clave = 'ComisionPorcentaje' LIMIT 1`,
  );
  const valor = Number(rows[0]?.Valor);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100
    ? valor
    : PORCENTAJE_COMISION_POR_DEFECTO;
}

// Reparte un pago entre Psynex y el psicólogo.
// Se redondea a pesos enteros y el neto se calcula por resta, para que
// comisión + neto siempre sumen exactamente el total.
export function calcularMontos(montoTotal: number, porcentaje: number) {
  const comision = Math.round((montoTotal * porcentaje) / 100);
  return {
    montoTotal,
    porcentajeComision: porcentaje,
    comisionPsynex: comision,
    montoNeto: montoTotal - comision,
  };
}
