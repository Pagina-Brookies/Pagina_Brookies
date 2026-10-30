'use strict';

const { getDb } = require('../config/mongo');
const { ok, fail } = require('../utils/respond');

/** GET /health: comprueba que la aplicación y la base de datos responden. */
async function check(req, res) {
  try {
    await getDb().command({ ping: 1 });
    return ok(res, { status: 'ok', database: 'up' });
  } catch (err) {
    console.error('[health] la base de datos no responde:', err.message);
    return fail(res, 503, 'base de datos no disponible');
  }
}

module.exports = { check };
