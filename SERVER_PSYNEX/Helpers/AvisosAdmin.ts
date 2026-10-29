// =====================================================================
// cambio: ARCHIVO NUEVO — avisar a los administradores que tienen algo
// por hacer: les crea una notificación (la campanita del admin) y les
// manda un correo. Si el correo falla, no se rompe nada (solo se registra).
//
// Tipos de aviso que se usan:
//   - Nuevo psicólogo por verificar     (registro de psicólogo)
//   - Nueva empresa por verificar       (registro de empresa)
//   - Comprobante de pago empresarial   (la empresa sube el comprobante)
//   - Nuevo pago por revisar            (un paciente envía un pago)
//   - Nuevo reclamo de pago             (un psicólogo reclama por sus pagos)
// =====================================================================
import { conexion } from "../Model/conexion.ts";
import { EmailService } from "./EmailService.ts";

export async function avisarAdmins(
  titulo: string,
  mensaje: string,
  ruta: string,
  opciones: { boton?: string; detalles?: [string, string][] } = {},
) {
  try {
    const admins = await conexion.query(
      `SELECT UsuarioId, NombreCompleto, Email FROM usuarios WHERE Rol = 'Admin' AND EstadoActivo = 1`,
    ) as { UsuarioId: string; NombreCompleto: string; Email: string }[];

    for (const a of admins) {
      await conexion.execute(
        `INSERT INTO notificaciones (NotificacionId, UsuarioId, Tipo, Titulo, Mensaje, EstaLeida, FechaEnvio)
         VALUES (?, ?, 'Sistema', ?, ?, 0, NOW())`,
        [crypto.randomUUID(), a.UsuarioId, titulo, mensaje],
      );
      if (a.Email) {
        EmailService.enviarAvisoAdmin({
          to: a.Email,
          nombre: a.NombreCompleto ?? "",
          titulo,
          // en el correo el mensaje va después de "Hola Nombre,"
          mensaje: mensaje.charAt(0).toLowerCase() + mensaje.slice(1),
          ruta,
          boton: opciones.boton,
          detalles: opciones.detalles,
        }).catch((e) => console.error("Correo al administrador:", e));
      }
    }
  } catch (e) {
    console.error("No se pudo avisar a los administradores:", e);
  }
}
