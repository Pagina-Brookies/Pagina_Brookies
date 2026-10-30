'use strict';

const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils/errors');
const Usuario = require('../models/usuario.model');

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Falta JWT_SECRET (mínimo 16 caracteres). Defínelo en el archivo .env o en las variables de Render.');
  }
  return s;
}

/** Firma el token de sesión. Lleva solo lo necesario: id y rol (nunca la contraseña ni datos personales). */
function signToken(user) {
  return jwt.sign({ sub: user._id, rol: user.rol }, secret(), { expiresIn: EXPIRES_IN });
}

/** Exige un token válido en "Authorization: Bearer <token>" y deja el usuario en req.user. */
async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const m = /^Bearer (.+)$/.exec(header);
    if (!m) throw new HttpError(401, 'falta iniciar sesión (encabezado Authorization: Bearer <token>)');
    let payload;
    try {
      payload = jwt.verify(m[1], secret());
    } catch (e) {
      throw new HttpError(401, e.name === 'TokenExpiredError' ? 'la sesión expiró, inicie sesión de nuevo' : 'token inválido');
    }
    const user = await Usuario.findById(payload.sub);
    if (!user || !user.activo) throw new HttpError(401, 'la cuenta no existe o está desactivada');
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Después de requireAuth: solo deja pasar a los roles indicados (RF03b, RNF08). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return next(new HttpError(403, 'no tiene permiso para esta operación'));
    }
    return next();
  };
}

module.exports = { signToken, requireAuth, requireRole, secret };
