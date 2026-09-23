'use strict';

/**
 * Éxito y error comparten la misma forma de respuesta:
 *   { data: <contenido o null>, errors: [ ... ] }
 */
function ok(res, data, status = 200) {
  return res.status(status).json({ data, errors: [] });
}

function fail(res, status, errors) {
  return res.status(status).json({ data: null, errors: Array.isArray(errors) ? errors : [errors] });
}

module.exports = { ok, fail };
