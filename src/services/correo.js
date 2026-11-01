'use strict';

const nodemailer = require('nodemailer');

/**
 * Envío de correos. Se usa el primero que esté configurado:
 * 1. Brevo (BREVO_API_KEY): API por HTTPS. Es el que sirve en Render, porque el plan gratis bloquea los puertos SMTP.
 * 2. SMTP con Nodemailer (SMTP_USER y SMTP_PASS; por defecto Gmail con una contraseña de aplicación).
 * 3. Nada configurado (por ejemplo en local): no se envía y el link se muestra en la consola.
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

/** Brevo exige un remitente verificado en su panel: MAIL_SENDER, o la cuenta de Gmail si no está definido. */
async function enviarConBrevo({ para, nombre, asunto, texto }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Brookies Coffee', email: process.env.MAIL_SENDER || process.env.SMTP_USER },
      to: [{ email: para, name: nombre }],
      subject: asunto,
      textContent: texto,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
  const asunto = 'Recupera tu contraseña de Brookies Coffee';
  const texto = `Hola ${nombre}:\n\nPara crear una contraseña nueva, abre este link (vale por ${minutos} minutos y se puede usar una sola vez):\n${link}\n\nSi no lo pediste, ignora este correo: tu contraseña no cambia.\n\nBrookies Coffee`;
  if (process.env.BREVO_API_KEY) return enviarConBrevo({ para: correo, nombre, asunto, texto });
  const t = getTransporte();
  if (!t) {
    console.log(`[correo] sin configurar. Link de recuperación para ${correo}: ${link}`);
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || `Brookies Coffee <${process.env.SMTP_USER}>`,
    to: correo,
    subject: asunto,
    text: texto,
  });
}

module.exports = { enviarRecuperacion, urlBase };
