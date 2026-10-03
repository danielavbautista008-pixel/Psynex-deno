// Validators/RegistroValidator.ts
// Esquemas de zod para los 3 registros + la lista de documentos de cada rol.
// Si tu AuthValidator.ts importa zod de otra forma, copia esa misma línea aquí.
import { z } from "../Dependencies/dependencias.ts";

// ---------- utilidades de fecha ----------
const fechaValida = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const edadDe = (s: string): number => {
  const hoy = new Date();
  const n = new Date(`${s}T00:00:00Z`);
  let edad = hoy.getUTCFullYear() - n.getUTCFullYear();
  const m = hoy.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && hoy.getUTCDate() < n.getUTCDate())) edad--;
  return edad;
};

// ---------- campos reutilizables ----------
const nombre = z.string().trim().min(2, "El nombre es obligatorio").max(120, "El nombre es demasiado largo");
const correo = z.string().trim().toLowerCase().email("Correo electrónico no válido").max(150, "El correo es demasiado largo");
// bcrypt solo usa los primeros 72 bytes: por eso el máximo.
const contrasena = z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72, "La contraseña es demasiado larga");
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento no válida")
  .refine(fechaValida, "Fecha de nacimiento no válida")
  .refine((s) => edadDe(s) >= 0 && edadDe(s) <= 120, "Fecha de nacimiento no válida");
const telefono = z.string().trim().regex(/^\d{7,15}$/, "Teléfono no válido");

// ---------- Paciente (JSON) ----------
export const pacienteSchema = z.object({
  nombreCompleto: nombre,
  email: correo,
  password: contrasena,
  fechaNacimiento: fecha,
  genero: z.enum(["", "Femenino", "Masculino", "Otro", "Prefiero no decirlo"]).optional(),
  telefono: z.union([z.literal(""), telefono]).optional(),
  esAnonimo: z.boolean().optional(),
});

// ---------- Psicólogo (multipart) ----------
export const psicologoSchema = z.object({
  nombreCompleto: nombre,
  email: correo,
  password: contrasena,
  fechaNacimiento: fecha.refine((s) => edadDe(s) >= 18, "Debes ser mayor de 18 años"),
  numeroDocumento: z.string().trim().regex(/^[0-9A-Za-z]{5,15}$/, "Número de documento no válido"),
});

// ---------- Empresa (multipart) ----------
export const empresaSchema = z.object({
  nombreEmpresa: z.string().trim().min(2, "El nombre de la empresa es obligatorio").max(150, "El nombre de la empresa es demasiado largo"),
  nit: z
    .string()
    .trim()
    .transform((s) => s.replace(/[.\s]/g, ""))
    .pipe(z.string().regex(/^\d{6,10}(-\d)?$/, "NIT no válido")),
  email: correo,
  telefono,
  sector: z.enum(["", "Salud", "Educacion", "Corporativo", "Gobierno"]).optional(),
  cantidadEmpleados: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int("La cantidad de empleados debe ser un número entero").min(1, "La cantidad de empleados no es válida").max(1_000_000, "La cantidad de empleados no es válida").optional()),
  password: contrasena,
});

export type PacienteDatos = z.infer<typeof pacienteSchema>;
export type PsicologoDatos = z.infer<typeof psicologoSchema>;
export type EmpresaDatos = z.infer<typeof empresaSchema>;

// ---------- Documentos que pide cada rol ----------
// "campo" es el nombre del input de archivo en el formulario: coincide con
// los data-doc-target de registro.astro.
export interface DocRequerido {
  campo: string;
  tipo: string; // se guarda en la tabla documentos
  etiqueta: string;
  obligatorio: boolean;
}

export const DOCS_PSICOLOGO: DocRequerido[] = [
  { campo: "tarjetaProfesional", tipo: "tarjeta_profesional", etiqueta: "Tarjeta profesional", obligatorio: true },
  { campo: "cedula", tipo: "cedula", etiqueta: "Cédula de ciudadanía", obligatorio: true },
  { campo: "diploma", tipo: "diploma", etiqueta: "Diploma o título profesional", obligatorio: true },
  { campo: "certificadoVigencia", tipo: "certificado_vigencia", etiqueta: "Certificado de vigencia", obligatorio: true },
];

export const DOCS_EMPRESA: DocRequerido[] = [
  { campo: "rut", tipo: "rut", etiqueta: "RUT", obligatorio: true },
  { campo: "camaraComercio", tipo: "camara_comercio", etiqueta: "Certificado de Cámara de Comercio", obligatorio: false },
];