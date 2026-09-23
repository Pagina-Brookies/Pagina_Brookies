'use strict';

const db = require('../config/db');
const { ok, fail } = require('../utils/respond');

/** GET /health - comprueba que la aplicación y la base de datos responden. */
async function check(req, res) {
  try {
    await db.execute('SELECT 1 AS ok');
    return ok(res, { status: 'ok', database: 'up' });
  } catch (err) {
    console.error('[health] la base de datos no responde:', err.message);
    return fail(res, 503, 'base de datos no disponible');
  }
}

module.exports = { check };
