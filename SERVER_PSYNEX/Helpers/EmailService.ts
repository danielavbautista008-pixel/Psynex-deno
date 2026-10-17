import { nodemailer } from "../Dependencies/dependencias.ts";

// =====================================================
// 1. TRANSPORTER
// =====================================================
function obtenerTransporter() {
  const host = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASSWORD");

  if (!user || !pass) {
    throw new Error("Faltan SMTP_USER o SMTP_PASSWORD en el archivo .env");
  }

  return {
    user,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
  };
}

function obtenerFrontendUrl(): string {
  return Deno.env.get("FRONTEND_URL") ?? "http://localhost:4321";
}


function plantillaHtmlBase(titulo: string, contenido: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2c2a26;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e5e2;">
            
            <!-- CABECERA VERDE SALVIA -->
            <tr>
              <td style="background-color:#4A6B5D;padding:36px 32px;text-align:center;">
                <!-- ICONO DOREDO -->
                <div style="margin-bottom:12px;text-align:center;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C4A574" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;">
                    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                    <path d="M12 5v13"/>
                    <path d="M9.5 9a1.5 1.5 0 0 0-1.5 1.5"/>
                    <path d="M14.5 9a1.5 1.5 0 0 1 1.5 1.5"/>
                  </svg>
                </div>
                <!-- PSYNEX EN DORADO -->
                <p style="margin:0;font-size:18px;letter-spacing:4px;color:#C4A574;text-transform:uppercase;font-weight:700;">
                  Psynex
                </p>
                <p style="margin:6px 0 0 0;font-size:14px;color:#E8EFEB;font-weight:300;">
                  Salud mental y bienestar
                </p>
              </td>
            </tr>

            <!-- CONTENIDO -->
            <tr>
              <td style="padding:36px 36px 28px 36px;color:#3a3835;line-height:1.65;font-size:15px;">
                ${contenido}
              </td>
            </tr>

            <!-- FOOTER EN VERDE CLARO -->
            <tr>
              <td style="padding:20px 32px;background-color:#E8EFEB;border-top:1px solid #e0e5e2;text-align:center;">
                <p style="margin:0;font-size:12px;color:#6b7c73;">
                  © ${year} Psynex · Este es un correo automático.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

const btn = `display:inline-block;background-color:#4A6B5D;color:#ffffff !important;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:15px;text-align:center;`;
const caja = `background-color:#E8EFEB;border-top:2px solid #4A6B5D;border-bottom:2px solid #4A6B5D;padding:18px 20px;margin:24px 0;border-radius:4px;text-align:center;`;
// Lo que escribe el usuario (nombre, motivo...) se escapa antes de ponerlo en el HTML
function escaparHtml(texto: string): string {
  return String(texto).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

// Lista con viñetas para los correos
function listaHtml(items: string[]): string {
  return `<ul style="margin:0 0 12px 0;padding-left:20px;font-size:14px;color:#5c574f;">
    ${items.map((i) => `<li style="margin:4px 0;">${i}</li>`).join("")}
  </ul>`;
}

function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] || nombreCompleto;
}

// =====================================================
// 3. SERVICIO
// =====================================================
export const EmailService = {

  // ---------- 1. BIENVENIDA (por rol) ----------
  async enviarBienvenida(datos: {
    to: string;
    nombreCompleto: string;
    rol: string;
  }) {
    const { transporter, user } = obtenerTransporter();
    const frontend = obtenerFrontendUrl();
    const nombre = primerNombre(datos.nombreCompleto);

    let subject = "Bienvenido a Psynex";
    let cuerpo = "";

    if (datos.rol === "Paciente") {
      subject = "Bienvenido a Psynex";
      cuerpo = `
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#2c2a26;">
          ¡Hola, ${nombre}!
        </h1>
        <p style="margin:0 0 12px 0;">
          Gracias por dar este paso. En <strong>Psynex</strong> creemos que cuidar la mente
          también es un acto de valentía, y no tienes que hacerlo en soledad.
        </p>
        <div style="${caja}">
          <p style="margin:0;font-size:14px;color:#5c574f;font-style:italic;">
            “Pequeños pasos, sostenidos en el tiempo, construyen grandes cambios.”
          </p>
        </div>
        <p style="margin:0 0 8px 0;font-size:14px;color:#5c574f;">
          Ya puedes explorar profesionales, agendar citas y usar herramientas pensadas para ti.
        </p>
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Ir a iniciar sesión</a>
        </div>
      `;
    } else if (datos.rol === "Psicologo") {
      // Correo 1 de 2: registro recibido, la cuenta queda en verificación
      subject = "Recibimos tu registro: tu cuenta está en verificación - Psynex";
      cuerpo = `
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#2c2a26;">
          Hola, ${escaparHtml(nombre)}
        </h1>
        <p style="margin:0 0 12px 0;">
          Gracias por sumarte a <strong>Psynex</strong> como profesional de la salud mental.
          Recibimos tu registro y tus documentos.
        </p>
        <div style="${caja}">
          <p style="margin:0;font-size:14px;color:#5c574f;">
            <strong>Estado de tu cuenta:</strong> en verificación.<br />
            Nuestro equipo está revisando tus documentos. Te enviaremos otro correo
            apenas tu cuenta quede verificada.
          </p>
        </div>
        <p style="margin:0 0 6px 0;font-size:14px;color:#5c574f;">Mientras tanto ya puedes:</p>
        ${listaHtml(["Completar tu perfil profesional.", "Configurar tu agenda y tus horarios."])}
        <p style="margin:0 0 6px 0;font-size:14px;color:#5c574f;">Cuando te verifiquemos podrás:</p>
        ${listaHtml([
          "Aparecer en Explorar para que los pacientes te encuentren.",
          "Recibir y gestionar citas.",
          "Postularte a ofertas laborales.",
        ])}
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Ir a mi cuenta</a>
        </div>
      `;
    } else if (datos.rol === "Empresa") {
      // Correo 1 de 2: registro recibido, la empresa queda en verificación
      subject = "Recibimos tu registro: tu empresa está en verificación - Psynex";
      cuerpo = `
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#2c2a26;">
          Hola, ${escaparHtml(datos.nombreCompleto)}
        </h1>
        <p style="margin:0 0 12px 0;">
          Gracias por confiar en <strong>Psynex</strong> para el bienestar de tu equipo.
          Recibimos el registro de tu empresa y sus documentos.
        </p>
        <div style="${caja}">
          <p style="margin:0;font-size:14px;color:#5c574f;">
            <strong>Estado de tu cuenta:</strong> en verificación.<br />
            Nuestro equipo está revisando el RUT y la información de tu empresa.
            Te enviaremos otro correo apenas la cuenta quede verificada.
          </p>
        </div>
        <p style="margin:0 0 6px 0;font-size:14px;color:#5c574f;">Cuando te verifiquemos podrás:</p>
        ${listaHtml([
          "Publicar ofertas laborales visibles para los psicólogos.",
          "Recibir y revisar postulaciones.",
          "Buscar psicólogos verificados.",
        ])}
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Ir a iniciar sesión</a>
        </div>
      `;
    } else {
      subject = "Bienvenido a Psynex";
      cuerpo = `
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#2c2a26;">
          ¡Hola, ${nombre}!
        </h1>
        <p style="margin:0 0 12px 0;">
          Te damos la bienvenida a <strong>Psynex</strong>.
        </p>
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Iniciar sesión</a>
        </div>
      `;
    }

    const html = plantillaHtmlBase(subject, cuerpo);

    return await transporter.sendMail({
      from: `"Psynex" <${user}>`,
      to: datos.to,
      subject,
      html,
    });
  },

  // ---------- 2. CONFIRMACIÓN DE CITA ----------
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
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
        Tu cita está confirmada
      </h1>
      <p style="margin:0 0 12px 0;">
        Hola <strong>${datos.nombreUsuario}</strong>, estos son los detalles de tu consulta:
      </p>
      <div style="${caja}">
        <p style="margin:6px 0;"><strong>Psicólogo(a):</strong> ${datos.nombrePsicologo}</p>
        <p style="margin:6px 0;"><strong>Fecha:</strong> ${datos.fecha}</p>
        <p style="margin:6px 0;"><strong>Hora:</strong> ${datos.hora}</p>
        <p style="margin:6px 0;"><strong>Modalidad:</strong> ${datos.modalidad}</p>
      </div>
      ${
        datos.enlaceVideollamada
          ? `<div style="text-align:center;margin:24px 0;">
               <a href="${datos.enlaceVideollamada}" style="${btn}">Unirse a la consulta</a>
             </div>`
          : ""
      }
      <p style="margin:0;font-size:13px;color:#5c574f;">
        Te recomendamos conectarte unos minutos antes, en un espacio tranquilo.
      </p>
      `,
    );

    return await transporter.sendMail({
      from: `"Psynex Citas" <${user}>`,
      to: datos.to,
      subject: `Confirmación de cita con ${datos.nombrePsicologo}`,
      html,
    });
  },

  // ---------- 3. RECORDATORIO ----------
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
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
        Recordatorio de tu cita
      </h1>
      <p style="margin:0 0 12px 0;">
        Hola <strong>${datos.nombreUsuario}</strong>, te recordamos tu próxima consulta:
      </p>
      <div style="${caja}">
        <p style="margin:6px 0;"><strong>Psicólogo(a):</strong> ${datos.nombrePsicologo}</p>
        <p style="margin:6px 0;"><strong>Fecha:</strong> ${datos.fecha}</p>
        <p style="margin:6px 0;"><strong>Hora:</strong> ${datos.hora}</p>
      </div>
      ${
        datos.enlaceVideollamada
          ? `<div style="text-align:center;margin:24px 0;">
               <a href="${datos.enlaceVideollamada}" style="${btn}">Ingresar a la sala</a>
             </div>`
          : ""
      }
      `,
    );

    return await transporter.sendMail({
      from: `"Psynex" <${user}>`,
      to: datos.to,
      subject: "Recordatorio de cita - Psynex",
      html,
    });
  },

  // ---------- 4. CANCELACIÓN ----------
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
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
        Tu cita fue cancelada
      </h1>
      <p style="margin:0 0 12px 0;">
        Hola <strong>${datos.nombreUsuario}</strong>, la cita del
        <strong>${datos.fecha}</strong> a las <strong>${datos.hora}</strong> ha sido cancelada.
      </p>
      ${
        datos.motivo
          ? `<div style="${caja}"><p style="margin:0;"><strong>Motivo:</strong> ${datos.motivo}</p></div>`
          : ""
      }
      <p style="margin:0 0 8px 0;font-size:14px;color:#5c574f;">
        Puedes reagendar cuando lo necesites.
      </p>
      <div style="text-align:center;margin:28px 0 8px 0;">
        <a href="${frontend}/citas" style="${btn}">Reagendar cita</a>
      </div>
      `,
    );

    return await transporter.sendMail({
      from: `"Psynex Citas" <${user}>`,
      to: datos.to,
      subject: "Cancelación de cita - Psynex",
      html,
    });
  },

  // ---------- 5. VERIFICACIÓN DE CUENTA ----------
  async enviarEstadoCuenta(datos: {
    to: string;
    nombre: string;
    rol: string;
    aprobado: boolean;
    motivoRechazo?: string;
  }) {
    const { transporter, user } = obtenerTransporter();
    const frontend = obtenerFrontendUrl();

    const subject = datos.aprobado
      ? "Tu cuenta fue verificada - Psynex"
      : "Actualización sobre tu verificación - Psynex";

    const html = plantillaHtmlBase(
      subject,
      datos.aprobado
        ? `
        <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
          ¡Tu cuenta fue verificada!
        </h1>
        <p style="margin:0 0 12px 0;">
          Hola <strong>${escaparHtml(datos.nombre)}</strong>, revisamos tus documentos y todo
          está en orden. Desde ahora ya puedes acceder a todo en Psynex.
        </p>
        <div style="${caja}">
          <p style="margin:0;"><strong>Estado:</strong> Verificada y activa</p>
        </div>
        <p style="margin:0 0 6px 0;font-size:14px;color:#5c574f;">Ya puedes:</p>
        ${listaHtml(
          datos.rol === "Empresa"
            ? [
              "Publicar ofertas laborales visibles para los psicólogos.",
              "Recibir y revisar postulaciones.",
              "Buscar psicólogos verificados.",
            ]
            : [
              "Aparecer en Explorar para que los pacientes te encuentren.",
              "Recibir y gestionar citas.",
              "Postularte a ofertas laborales.",
            ],
        )}
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Acceder a mi panel</a>
        </div>
        `
        : `
        <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
          Necesitamos ajustar tu verificación
        </h1>
        <p style="margin:0 0 12px 0;">
          Hola <strong>${escaparHtml(datos.nombre)}</strong>, la verificación de tu cuenta
          de <strong>${datos.rol === "Psicologo" ? "psicólogo" : datos.rol.toLowerCase()}</strong> requiere algunos ajustes.
        </p>
        <div style="${caja}">
          <p style="margin:0;">
            <strong>Observaciones:</strong>
            ${escaparHtml(datos.motivoRechazo || "Documentos incompletos o ilegibles.")}
          </p>
        </div>
        <p style="margin:0 0 8px 0;font-size:14px;color:#5c574f;">
          Ingresa a la plataforma para volver a subir los documentos.
        </p>
        <div style="text-align:center;margin:28px 0 8px 0;">
          <a href="${frontend}/Inicio/login" style="${btn}">Ir a mi cuenta</a>
        </div>
        `,
    );

    return await transporter.sendMail({
      from: `"Psynex" <${user}>`,
      to: datos.to,
      subject,
      html,
    });
  },

  // ---------- 6. RECUPERAR CONTRASEÑA ----------
  async enviarRecuperacionPassword(datos: {
    to: string;
    nombre: string;
    enlaceRecuperacion: string;
    minutos: number;
  }) {
    const { transporter, user } = obtenerTransporter();

    const html = plantillaHtmlBase(
      "Restablecer contraseña",
      `
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
        Restablecer contraseña
      </h1>
      <p style="margin:0 0 12px 0;">
        Hola <strong>${escaparHtml(primerNombre(datos.nombre))}</strong>, recibimos una solicitud para cambiar
        la contraseña de tu cuenta de Psynex.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${datos.enlaceRecuperacion}" style="${btn}">Cambiar mi contraseña</a>
      </div>
      <p style="margin:0 0 12px 0;font-size:14px;color:#5c574f;">
        El enlace sirve por <strong>${datos.minutos} minutos</strong> y solo se puede usar una vez.
      </p>
      <p style="margin:0;font-size:14px;color:#5c574f;">
        Si no fuiste tú, ignora este mensaje: tu contraseña no va a cambiar.
      </p>
      `,
    );

    return await transporter.sendMail({
      from: `"Psynex Seguridad" <${user}>`,
      to: datos.to,
      subject: "Restablece tu contraseña - Psynex",
      html,
    });
  },

  // ---------- 7. CONTRASEÑA CAMBIADA (aviso de seguridad) ----------
  async enviarPasswordCambiada(datos: { to: string; nombre: string }) {
    const { transporter, user } = obtenerTransporter();
    const fecha = new Date().toLocaleString("es-CO", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Bogota",
    });

    const html = plantillaHtmlBase(
      "Tu contraseña fue cambiada",
      `
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#2c2a26;">
        Tu contraseña fue cambiada
      </h1>
      <p style="margin:0 0 12px 0;">
        Hola <strong>${escaparHtml(primerNombre(datos.nombre))}</strong>, la contraseña de tu cuenta
        de Psynex se cambió el ${escaparHtml(fecha)}.
      </p>
      <div style="${caja}">
        <p style="margin:0;font-size:14px;color:#2c2a26;">
          Si fuiste tú, no tienes que hacer nada.
        </p>
      </div>
      <p style="margin:0 0 12px 0;font-size:14px;color:#5c574f;">
        Si <strong>no</strong> fuiste tú, cambia tu contraseña de inmediato desde
        "¿Olvidaste tu contraseña?" y escríbenos.
      </p>
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${obtenerFrontendUrl()}/Inicio/login" style="${btn}">Ir a Psynex</a>
      </div>
      `,
    );

    return await transporter.sendMail({
      from: `"Psynex Seguridad" <${user}>`,
      to: datos.to,
      subject: "Tu contraseña fue cambiada - Psynex",
      html,
    });
  },
};