'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enviarRecuperacion } = require('../src/services/correo');

const VARS = ['BREVO_API_KEY', 'MAIL_SENDER', 'SMTP_USER', 'SMTP_PASS', 'APP_URL'];

/** Corre fn con estas variables de entorno y un fetch simulado; después deja todo como estaba. */
async function con(env, fetchFalso, fn) {
  const antes = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
  const fetchOriginal = global.fetch;
  VARS.forEach((k) => { delete process.env[k]; });
  Object.assign(process.env, env);
  global.fetch = fetchFalso;
  try { await fn(); } finally {
    global.fetch = fetchOriginal;
    VARS.forEach((k) => { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; });
  }
}

test('con BREVO_API_KEY el correo sale por la API de Brevo, con el link y el remitente verificado', async () => {
  const llamadas = [];
  const fetchFalso = async (url, opts) => { llamadas.push({ url, opts }); return { ok: true, text: async () => '' }; };
  await con({ BREVO_API_KEY: 'clave-de-prueba', MAIL_SENDER: 'remitente@gmail.com', APP_URL: 'https://brookies.example/' }, fetchFalso, async () => {
    await enviarRecuperacion({ correo: 'ana@correo.cl', nombre: 'Ana', token: 'abc123', minutos: 30 });
  });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(llamadas[0].opts.headers['api-key'], 'clave-de-prueba');
  const body = JSON.parse(llamadas[0].opts.body);
  assert.equal(body.sender.email, 'remitente@gmail.com');
  assert.deepEqual(body.to, [{ email: 'ana@correo.cl', name: 'Ana' }]);
  assert.match(body.textContent, /https:\/\/brookies\.example\/#\/restablecer\?token=abc123/);
});

test('si Brevo responde con error, el envío falla con el código para verlo en los logs', async () => {
  const fetchFalso = async () => ({ ok: false, status: 401, text: async () => 'Key not found' });
  await con({ BREVO_API_KEY: 'mala', MAIL_SENDER: 'remitente@gmail.com' }, fetchFalso, async () => {
    await assert.rejects(enviarRecuperacion({ correo: 'ana@correo.cl', nombre: 'Ana', token: 'abc', minutos: 30 }), /Brevo respondió 401/);
  });
});
