// =====================================================================
// cambio: ARCHIVO NUEVO — Registro emocional diario del paciente.
// Tabla registroemocional (un registro por paciente y por día):
//   PacienteId    -> UsuarioId del paciente (así está el registro que ya existía)
//   Fecha         -> día del registro (hora de Colombia)
//   Estado        -> "Muy mal" | "Mal" | "Normal" | "Bien" | "Muy bien"
//   Intensidad    -> 1 a 5 (el mismo estado en número, para las gráficas)
//   Factores      -> causas: "Familia, Trabajo"
//   Emociones     -> "Calma, Alegría"
//   HorasSueno, Energia, Observaciones (nota), Compartido (1 = lo ve su psicólogo)
// =====================================================================
import { conexion } from "../conexion.ts";
import type { RegistroEmocionalInput } from "../../Validators/Paciente/PacienteValidator.ts";

type Fila = Record<string, unknown>;
const texto = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const ESTADOS = ["", "Muy mal", "Mal", "Normal", "Bien", "Muy bien"];

// Día de hoy en Colombia (AAAA-MM-DD), aunque el servidor tenga otra zona horaria
export const hoyColombia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

const lista = (v: unknown) => texto(v).split(",").map((s) => s.trim()).filter(Boolean);

// Nivel 1-5: primero por el texto del estado; si no coincide, por la intensidad
const nivel = (f: Fila) => {
  const porTexto = ESTADOS.indexOf(texto(f.Estado));
  if (porTexto > 0) return porTexto;
  return Math.min(5, Math.max(1, Math.round(Number(f.Intensidad ?? 3))));
};

const armar = (f: Fila) => ({
  fecha: texto(f.Fecha),
  estado: nivel(f),
  emociones: lista(f.Emociones),
  causas: lista(f.Factores),
  sueno: f.HorasSueno === null || f.HorasSueno === undefined ? "" : String(Number(f.HorasSueno)),
  energia: texto(f.Energia),
  nota: texto(f.Observaciones),
  compartir: Number(f.Compartido ?? 1) === 1,
});

export const RegistroEmocionalModel = {
  // Registros del paciente (los más recientes primero)
  async listar(usuarioId: string, dias = 365) {
    const filas = await conexion.query(
      `SELECT DATE_FORMAT(Fecha, '%Y-%m-%d') AS Fecha, Estado, Intensidad, Factores, Emociones,
              HorasSueno, Energia, Observaciones, Compartido
       FROM registroemocional
       WHERE PacienteId = ? AND Fecha IS NOT NULL AND Fecha >= DATE_SUB(?, INTERVAL ? DAY)
       ORDER BY Fecha DESC`,
      [usuarioId, hoyColombia(), dias],
    ) as Fila[];
    return filas.map(armar);
  },

  async deHoy(usuarioId: string) {
    const [f] = await conexion.query(
      `SELECT DATE_FORMAT(Fecha, '%Y-%m-%d') AS Fecha, Estado, Intensidad, Factores, Emociones,
              HorasSueno, Energia, Observaciones, Compartido
       FROM registroemocional WHERE PacienteId = ? AND Fecha = ? LIMIT 1`,
      [usuarioId, hoyColombia()],
    ) as Fila[];
    return f ? armar(f) : null;
  },

  // Guarda el registro de hoy (si ya existe, lo actualiza)
  async guardarHoy(usuarioId: string, d: RegistroEmocionalInput) {
    const hoy = hoyColombia();
    const estadoTexto = ESTADOS[d.estado];

    if (d.soloEstado) {
      // Desde Inicio: solo la carita; lo demás que ya tuviera se conserva
      await conexion.execute(
        `INSERT INTO registroemocional (RegistroId, PacienteId, Fecha, Estado, Intensidad, Compartido, CreadoEn)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE Estado = VALUES(Estado), Intensidad = VALUES(Intensidad)`,
        [crypto.randomUUID(), usuarioId, hoy, estadoTexto, d.estado],
      );
    } else {
      const sueno = d.sueno === "" || d.sueno === null || d.sueno === undefined ? null : Number(d.sueno);
      await conexion.execute(
        `INSERT INTO registroemocional
           (RegistroId, PacienteId, Fecha, Estado, Intensidad, Factores, Emociones, HorasSueno, Energia, Observaciones, Compartido, CreadoEn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           Estado = VALUES(Estado), Intensidad = VALUES(Intensidad), Factores = VALUES(Factores),
           Emociones = VALUES(Emociones), HorasSueno = VALUES(HorasSueno), Energia = VALUES(Energia),
           Observaciones = VALUES(Observaciones), Compartido = VALUES(Compartido)`,
        [
          crypto.randomUUID(), usuarioId, hoy, estadoTexto, d.estado,
          d.causas.join(", ") || null,
          d.emociones.join(", ") || null,
          sueno,
          d.energia || null,
          d.nota || null,
          d.compartir ? 1 : 0,
        ],
      );
    }
    return await this.deHoy(usuarioId);
  },
};
