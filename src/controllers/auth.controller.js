'use strict';

const bcrypt = require('bcryptjs');
const Usuario = require('../models/usuario.model');
const { signToken } = require('../middleware/auth');
const { validateRegister, validateLogin, validateProfile } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

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

module.exports = { register, login, me, updateMe };
