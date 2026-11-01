'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const mailer = require('../services/correo');
const { signToken } = require('../middleware/auth');
const { validateRegister, validateLogin, validateForgot, validateReset, validateProfile } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

const RESET_MINUTOS = 30;
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

// hash de relleno: login compara siempre contra un hash, exista o no el correo, para no filtrar cuentas por tiempo
const DUMMY_HASH = bcrypt.hashSync('relleno-no-valido-1', 10);

/** POST /api/v1/auth/register (RF01): crea una cuenta de cliente y abre sesión. */
async function register(req, res) {
  const { errors, data } = validateRegister(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (await Usuario.findByEmail(data.correo)) return fail(res, 409, { field: 'correo', message: 'ya existe una cuenta con ese correo' });
  const user = await Usuario.createClient({ ...data, contrasena_hash: await bcrypt.hash(data.contrasena, 10) });
  return ok(res, { token: signToken(user), usuario: Usuario.toPublic(user) }, 201);
}

/** POST /api/v1/auth/login (RF02). El mensaje de error es el mismo si falla el correo o la clave. */
async function login(req, res) {
  const { errors, data } = validateLogin(req.body);
  if (errors.length) return fail(res, 400, errors);
  const user = await Usuario.findByEmail(data.correo);
  const valid = await bcrypt.compare(data.contrasena, user ? user.contrasena_hash : DUMMY_HASH);
  if (!user || !valid || !user.activo) return fail(res, 401, 'correo o contraseña incorrectos');
  await Usuario.touchLogin(user._id);
  return ok(res, { token: signToken(user), usuario: Usuario.toPublic(user) });
}

/**
 * POST /api/v1/auth/forgot-password: envía un link para crear una contraseña nueva.
 * Responde lo mismo exista o no la cuenta, y no espera el envío, para no revelar qué correos están registrados.
 */
async function forgotPassword(req, res) {
  const { errors, data } = validateForgot(req.body);
  if (errors.length) return fail(res, 400, errors);
  const user = await Usuario.findByEmail(data.correo);
  if (user && user.activo) {
    const token = crypto.randomBytes(32).toString('hex');
    await Usuario.setReset(user._id, sha256(token), new Date(Date.now() + RESET_MINUTOS * 60 * 1000));
    mailer.enviarRecuperacion({ correo: user.correo, nombre: user.nombre, token, minutos: RESET_MINUTOS })
      .catch((e) => console.error('[correo] no se pudo enviar la recuperación:', e.message));
  }
  return ok(res, { mensaje: 'si el correo tiene una cuenta, enviamos un link para crear una contraseña nueva' });
}

/** POST /api/v1/auth/reset-password: cambia la contraseña con el token del link (un solo uso, vence en 30 minutos). */
async function resetPassword(req, res) {
  const { errors, data } = validateReset(req.body);
  if (errors.length) return fail(res, 400, errors);
  const hash = sha256(data.token);
  const user = await Usuario.findByResetHash(hash);
  if (!user) return fail(res, 400, { field: 'token', message: 'el link no es válido o ya venció; pide uno nuevo' });
  const r = await Usuario.resetPassword(user._id, hash, await bcrypt.hash(data.contrasena, 10));
  if (!r.modifiedCount) return fail(res, 400, { field: 'token', message: 'el link no es válido o ya venció; pide uno nuevo' }); // se usó dos veces a la vez
  return ok(res, { mensaje: 'contraseña actualizada' });
}

/** GET /api/v1/users/me */
async function me(req, res) {
  return ok(res, Usuario.toPublic(req.user));
}

/** PUT /api/v1/users/me (RF03): edita los datos personales del cliente. */
async function updateMe(req, res) {
  const { errors, data } = validateProfile(req.body);
  if (errors.length) return fail(res, 400, errors);
  const user = await Usuario.updateProfile(req.user._id, data);
  if (!user) return fail(res, 403, 'solo las cuentas de cliente tienen datos de perfil editables');
  return ok(res, Usuario.toPublic(user));
}

module.exports = { register, login, forgotPassword, resetPassword, me, updateMe };
