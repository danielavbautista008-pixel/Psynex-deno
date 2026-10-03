import { nodemailer } from "../Dependencies/dependencias.ts";

//
// 1. CONFIGURACIÓN DEL TRANSPORTER (quién envía el correo)
//
function obtenerTransporter() {
  // Leemos las variables del archivo .env
  const host = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");

  // Si faltan las credenciales, lanzamos error claro
  if (!user || !pass) {
    throw new Error("Faltan SMTP_USER o SMTP_PASSWORD en el archivo .env");
  }

  return {
    user, // el correo desde el que se envía
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true solo si usas puerto 465
      auth: {
        user,
        pass, // App Password de Gmail (no la contraseña normal)
      },
    }),
  };
}

// =====================================================
// 2. URL DEL FRONTEND (para los botones de los correos)
// =====================================================
function obtenerFrontendUrl(): string {
  // Ejemplo: http://localhost:4321  o  https://psynex.com
  return Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321";
}

// =====================================================
// 3. PLANTILLA HTML BASE (diseño limpio y profesional)
// =====================================================
function plantillaHtmlBase(titulo: string, contenido: string): string {
  const year = new Date().getFullYear();

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
            
            <!-- ENCABEZADO -->
            <tr>
              <td style="padding:28px 32px 20px 32px; border-bottom:1px solid #e2e8f0;">
                <p style="margin:0; font-size:20px; font-weight:700; color:#0f172a;">Psynex</p>
                <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">Salud mental y bienestar</p>
              </td>
            </tr>

            <!-- CONTENIDO DINÁMICO -->
            <tr>
              <td style="padding:28px 32px;">
                ${contenido}
              </td>
            </tr>

            <!-- PIE DE PÁGINA -->
            <tr>
              <td style="padding:20px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
                <p style="margin:0; font-size:12px; color:#94a3b8;">
                  © ${year} Psynex · Este es un correo automático, no respondas a este mensaje.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// =====================================================
// 4. ESTILOS REUTILIZABLES (botones y cajas de información)
// =====================================================
const btn = (color = "#4f46e5") =>
  `display:inline-block;background-color:${color};color:#ffffff !important;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;font-size:15px;`;

const infoBox = (borde = "#4f46e5", fondo = "#f8fafc") =>
  `background-color:${fondo};border-left:4px solid ${borde};padding:14px 16px;margin:18px 0;border-radius:4px;`;

// =====================================================
// 5. SERVICIO DE CORREOS (los métodos que vas a usar)
// =====================================================
export const EmailService = {

  // ---------------------------------------------
  // 1. Correo de bienvenida (cuando se registra alguien)
  // ---------------------------------------------
  async enviarBienvenida(datos: {
    to: string;
    nombreCompleto: string;
    rol: string;
  }) {
    const { transporter, user } = obtenerTransporter();
    const frontend = obtenerFrontendUrl();

    const html = plantillaHtmlBase(
      "Bienvenido a Psynex",
      `
      <h2 style="color:#1e293b; margin-top:0; font-size:18px;">¡Hola, ${datos.nombreCompleto}!</h2>
      <p style="font-size:15px; line-height:1.6; color:#475569;">
        Te damos la bienvenida a <strong>Psynex</strong>. Nos alegra tenerte en nuestra plataforma de salud mental y bienestar.
      </p>

      <div style="${infoBox()}">
        <p style="margin:0 0 8px 0; font-weight:600; color:#1e293b;">Resumen de tu cuenta</p>
        <p style="margin:4px 0; color:#475569;"><strong>Correo:</strong> ${datos.to}</p>
        <p style="margin:4px 0; color:#475569;"><strong>Rol:</strong> ${datos.rol}</p>
        <p style="margin:4px 0; color:#475569;"><strong>Estado:</strong> Activa</p>
      </div>

      <p style="font-size:14px; color:#475569;">
        Ya puedes ingresar y comenzar a usar la plataforma.
      </p>

      <div style="text-align:center; margin-top:24px;">
        <a href="${frontend}/Inicio/login" style="${btn()}">Iniciar sesión</a>
      </div>
      `
    );

    return await transporter.sendMail({
      from: `"Psynex" <${user}>`,
      to: datos.to,
      subject: "Bienvenido a Psynex",
      html,
    });
  },

  // ---------------------------------------------
  // 2. Confirmación de cita
  // ---------------------------------------------
  async enviarAceptacionCita(datos: {
    to: string;
    nombreUsuario: string;
    nombrePsicologo: string;
    fecha: string;
    hora: string;
    modalidad: string;
    enlaceVideollamada?: string;
  }) {
    const { transporter, user } = obtenerTransporter();

    const html = plantillaHtmlBase(
      "Confirmación de cita",
      `
      <h2 style="color:#059669; margin-top:0; font-size:18px;">Tu cita ha sido confirmada</h2>
      <p style="font-size:15px; color:#475569;">
        Hola <strong>${datos.nombreUsuario}</strong>, te confirmamos los detalles de tu cita:
      </p>

      <div style="${infoBox("#10b981", "#f0fdf4")}">
        <p style="margin:6px 0; color:#1e293b;"><strong>Psicólogo(a):</strong> ${datos.nombrePsicologo}</p>
        <p style="margin:6px 0; color:#1e293b;"><strong>Fecha:</strong> ${datos.fecha}</p>
        <p style="margin:6px 0; color:#1e293b;"><strong>Hora:</strong> ${datos.hora}</p>
        <p style="margin:6px 0; color:#1e293b;"><strong>Modalidad:</strong> ${datos.modalidad}</p>
      </div>

      ${
        datos.enlaceVideollamada
          ? `
          <div style="text-align:center; margin:24px 0;">
            <a href="${datos.enlaceVideollamada}" style="${btn("#10b981")}">Unirse a la consulta</a>
          </div>
          `
          : ""
      }

      <p style="font-size:13px; color:#64748b; margin-top:16px;">
        Te recomendamos conectarte unos minutos antes en un espacio tranquilo.
      </p>
      `
    );

    return await transporter.sendMail({
      from: `"Psynex Citas" <${user}>`,
      to: datos.to,
      subject: `Confirmación de cita con ${datos.nombrePsicologo}`,
      html,
    });
  },

  // ---------------------------------------------
  // 3. Recordatorio de cita
  // ---------------------------------------------
  async enviarRecordatorioCita(datos: {
    to: string;
    nombreUsuario: string;
    nombrePsicologo: string;
    fecha: string;
    hora: string;
    enlaceVideollamada?: string;
  }) {
    const { transporter, user } = obtenerTransporter();

    const html = plantillaHtmlBase(
      "Recordatorio de cita",
      `
      <h2 style="color:#d97706; margin-top:0; font-size:18px;">Recordatorio de tu próxima cita</h2>
      <p style="font-size:15px; color:#475569;">
        Hola <strong>${datos.nombreUsuario}</strong>, te recordamos tu consulta:
      </p>

      <div style="${infoBox("#f59e0b", "#fffbeb")}">
        <p style="margin:6px 0; color:#1e293b;"><strong>Psicólogo(a):</strong> ${datos.nombrePsicologo}</p>
        <p style="margin:6px 0; color:#1e293b;"><strong>Fecha:</strong> ${datos.fecha}</p>
        <p style="margin:6px 0; color:#1e293b;"><strong>Hora:</strong> ${datos.hora}</p>
      </div>

      ${
        datos.enlaceVideollamada
          ? `
          <div style="text-align:center; margin:20px 0;">
            <a href="${datos.enlaceVideollamada}" style="${btn("#f59e0b")}">Ingresar a la sala</a>
          </div>
          `
          : ""
      }
      `
    );

    return await transporter.sendMail({
      from: `"Psynex Recordatorios" <${user}>`,
      to: datos.to,
      subject: "Recordatorio de cita - Psynex",
      html,
    });
  },

  // ---------------------------------------------
  // 4. Cancelación de cita
  // ---------------------------------------------
  async enviarCancelacionCita(datos: {
    to: string;
    nombreUsuario: string;
    fecha: string;
    hora: string;
    motivo?: string;
  }) {
    const { transporter, user } = obtenerTransporter();
    const frontend = obtenerFrontendUrl();

    const html = plantillaHtmlBase(
      "Cita cancelada",
      `
      <h2 style="color:#dc2626; margin-top:0; font-size:18px;">Tu cita ha sido cancelada</h2>
      <p style="font-size:15px; color:#475569;">
        Hola <strong>${datos.nombreUsuario}</strong>, la cita del <strong>${datos.fecha}</strong> a las <strong>${datos.hora}</strong> ha sido cancelada.
      </p>

      ${
        datos.motivo
          ? `
          <div style="${infoBox("#ef4444", "#fef2f2")}">
            <p style="margin:0; color:#991b1b;"><strong>Motivo:</strong> ${datos.motivo}</p>
          </div>
          `
          : ""
      }

      <p style="font-size:14px; color:#475569;">
        Puedes ingresar a la plataforma para reagendar cuando quieras.
      </p>

      <div style="text-align:center; margin-top:22px;">
        <a href="${frontend}/citas" style="${btn("#dc2626")}">Reagendar cita</a>
      </div>
      `
    );

    return await transporter.sendMail({
      from: `"Psynex Citas" <${user}>`,
      to: datos.to,
      subject: "Cancelación de cita - Psynex",
      html,
    });
  },

  // ---------------------------------------------
  // 5. Aprobación o rechazo de cuenta (psicólogos / empresas)
  // ---------------------------------------------
  async enviarEstadoCuenta(datos: {
    to: string;
    nombre: string;
    rol: string;
    aprobado: boolean;
    motivoRechazo?: string;
  }) {
    const { transporter, user } = obtenerTransporter();
    const frontend = obtenerFrontendUrl();

    const titulo = datos.aprobado
      ? "Cuenta verificada y aprobada"
      : "Actualización sobre tu verificación";

    const html = plantillaHtmlBase(
      titulo,
      `
      <h2 style="color:${datos.aprobado ? "#059669" : "#d97706"}; margin-top:0; font-size:18px;">
        ${titulo}
      </h2>
      <p style="font-size:15px; color:#475569;">
        Hola <strong>${datos.nombre}</strong>,
      </p>

      ${
        datos.aprobado
          ? `
          <p style="font-size:14px; color:#475569;">
            La revisión de tus documentos para el rol de <strong>${datos.rol}</strong> ha sido aprobada.
          </p>
          <div style="${infoBox("#10b981", "#f0fdf4")}">
            <p style="margin:0; color:#065f46;"><strong>Estado:</strong> Verificada y Activa</p>
          </div>
          <div style="text-align:center; margin-top:22px;">
            <a href="${frontend}/Inicio/login" style="${btn("#10b981")}">Acceder a mi panel</a>
          </div>
          `
          : `
          <p style="font-size:14px; color:#475569;">
            La verificación de tus documentos para el rol de <strong>${datos.rol}</strong> requiere ajustes.
          </p>
          <div style="${infoBox("#f59e0b", "#fffbeb")}">
            <p style="margin:0; color:#92400e;">
              <strong>Observaciones:</strong> ${datos.motivoRechazo || "Documentos incompletos o ilegibles."}
            </p>
          </div>
          <p style="font-size:13px; color:#475569;">
            Ingresa a la plataforma para volver a subir los documentos.
          </p>
          `
      }
      `
    );

    return await transporter.sendMail({
      from: `"Psynex Administración" <${user}>`,
      to: datos.to,
      subject: "Notificación de verificación de cuenta - Psynex",
      html,
    });
  },

  // ---------------------------------------------
  // 6. Recuperación de contraseña
  // ---------------------------------------------
  async enviarRecuperacionPassword(datos: {
    to: string;
    nombre: string;
    enlaceRecuperacion: string;
  }) {
    const { transporter, user } = obtenerTransporter();

    const html = plantillaHtmlBase(
      "Recuperar contraseña",
      `
      <h2 style="color:#4f46e5; margin-top:0; font-size:18px;">Restablecimiento de contraseña</h2>
      <p style="font-size:15px; color:#475569;">
        Hola <strong>${datos.nombre}</strong>, has solicitado restablecer tu contraseña.
      </p>
      <p style="font-size:14px; color:#475569;">
        Haz clic en el botón. Este enlace expira en <strong>60 minutos</strong>.
      </p>

      <div style="text-align:center; margin:26px 0;">
        <a href="${datos.enlaceRecuperacion}" style="${btn()}">Cambiar mi contraseña</a>
      </div>

      <p style="font-size:13px; color:#64748b;">
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>
      `
    );

    return await transporter.sendMail({
      from: `"Psynex Seguridad" <${user}>`,
      to: datos.to,
      subject: "Restablecimiento de contraseña - Psynex",
      html,
    });
  },
};