'use strict';

const rateLimit = require('express-rate-limit');
const { fail } = require('../utils/respond');

const handler = (req, res) => fail(res, 429, 'demasiadas peticiones, espere un momento antes de reintentar');

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** Límite general de la API: por defecto 300 peticiones cada 15 minutos por IP. */
const apiLimiter = rateLimit({
  windowMs: num(process.env.RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.RATE_LIMIT, 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

/** Límite estricto para registro e inicio de sesión (frena la adivinación de contraseñas): 20 cada 15 minutos. */
const authLimiter = rateLimit({
  windowMs: num(process.env.RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.AUTH_RATE_LIMIT, 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter };
