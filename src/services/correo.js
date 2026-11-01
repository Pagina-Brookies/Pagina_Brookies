'use strict';

const nodemailer = require('nodemailer');

/**
 * Envío de correos con Nodemailer (por defecto, Gmail con una contraseña de aplicación).
 * Si faltan SMTP_USER o SMTP_PASS (por ejemplo en local) no se envía nada: el link se muestra en la consola.
 */
let transporte = null;
function getTransporte() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

/**
 * Dirección pública de la página para armar el link. Se toma de la configuración y nunca del encabezado Host
 * de la petición, para que nadie pueda hacer que el correo apunte a otro sitio.
 */
function urlBase() {
  const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
  return url.replace(/\/+$/, '');
}

/** Envía el link para crear una contraseña nueva. */
async function enviarRecuperacion({ correo, nombre, token, minutos }) {
  const link = `${urlBase()}/#/restablecer?token=${token}`;
  const t = getTransporte();
  if (!t) {
    console.log(`[correo] SMTP sin configurar. Link de recuperación para ${correo}: ${link}`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || `Brookies Coffee <${process.env.SMTP_USER}>`,
    to: correo,
    subject: 'Recupera tu contraseña de Brookies Coffee',
    text: `Hola ${nombre}:\n\nPara crear una contraseña nueva, abre este link (vale por ${minutos} minutos y se puede usar una sola vez):\n${link}\n\nSi no lo pediste, ignora este correo: tu contraseña no cambia.\n\nBrookies Coffee`,
  });
}

module.exports = { enviarRecuperacion, urlBase };
