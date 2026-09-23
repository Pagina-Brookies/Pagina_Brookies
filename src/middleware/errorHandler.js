'use strict';

const { fail } = require('../utils/respond');

function notFound(req, res) {
  return fail(res, 404, `ruta no encontrada: ${req.method} ${req.originalUrl}`);
}

// Al usuario se le muestra un mensaje genérico; el detalle técnico queda en el registro.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'el cuerpo de la petición no es un JSON válido');
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  return fail(res, 500, 'error interno, intente más tarde');
}

module.exports = { notFound, errorHandler };
