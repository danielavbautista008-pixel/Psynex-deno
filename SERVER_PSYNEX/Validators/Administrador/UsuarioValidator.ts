import { z } from "../../Dependencies/dependencias.ts";

// Valores EXACTOS de la columna Rol en la base de datos.
export const RolEnum = z.enum(["Paciente", "Psicologo", "Empresa", "Admin"]);

// Fecha real (YYYY-MM-DD), que no sea futura ni de hace más de 120 años.
const fechaNacimiento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento no válida")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Fecha de nacimiento no válida")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    const limite = new Date().getUTCFullYear() - 120;
    return d <= new Date() && d.getUTCFullYear() >= limite;
  }, "Fecha de nacimiento no válida");

// Correo normalizado: sin espacios y en minúsculas.
const correo = z.string().trim().toLowerCase().email("Correo inválido").max(256);

// Registro público: solo "Paciente". Psicólogos y empresas se registran por su
// propio flujo (con documentos). Nadie puede autorregistrarse como Admin.
export const registroSchema = z.object({
  nombreCompleto: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(150),
  fechaNacimiento,
  rol: z.literal("Paciente"),
  email: correo,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga") // bcrypt solo usa los primeros 72 bytes
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[0-9]/, "Debe incluir al menos un número"),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: correo,
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Filtros del listado de usuarios (RF-40). Los administradores nunca se listan.
export const filtroUsuariosSchema = z.object({
  rol: RolEnum.exclude(["Admin"]).optional(),
  estadoActivo: z.enum(["true", "false"]).optional(),
  busqueda: z.string().trim().max(100).optional(), // nombre, correo o documento
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});
export type FiltroUsuariosInput = z.infer<typeof filtroUsuariosSchema>;

// Activar o desactivar una cuenta (RF-40).
// Al desactivar, el motivo es obligatorio: queda guardado como observación.
export const cambiarEstadoSchema = z
  .object({
    estadoActivo: z.boolean(),
    motivo: z.string().trim().max(500, "El motivo es demasiado largo").optional(),
  })
  .refine(
    (d) => d.estadoActivo || (d.motivo !== undefined && d.motivo.length >= 5),
    { message: "Indica el motivo de la desactivación (mínimo 5 caracteres)", path: ["motivo"] },
  );
export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

// Nota libre que el administrador agrega al historial de un usuario.
export const observacionSchema = z.object({
  texto: z.string().trim().min(3, "Escribe al menos 3 caracteres").max(500, "Máximo 500 caracteres"),
});
export type ObservacionInput = z.infer<typeof observacionSchema>;