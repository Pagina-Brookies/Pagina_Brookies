'use strict';

const { fail } = require('../utils/respond');
const { HttpError } = require('../utils/errors');

function notFound(req, res) {
  return fail(res, 404, `ruta no encontrada: ${req.method} ${req.originalUrl}`);
}

// Errores del driver que indican que la base no está alcanzable (apagada, sin red, DNS).
const DB_DOWN = new Set(['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError']);

// Al usuario se le muestra un mensaje genérico; el detalle técnico queda en el registro (RNF16).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return fail(res, err.status, err.errors);
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'el cuerpo de la petición no es un JSON válido (revise comillas y comas)');
  }
  if (err && err.type === 'entity.too.large') {
    return fail(res, 413, 'el cuerpo de la petición es demasiado grande');
  }
  if (err && DB_DOWN.has(err.name)) {
    console.error(`[db] ${req.method} ${req.originalUrl}: base de datos no disponible (${err.name})`);
    return fail(res, 503, 'la base de datos no está disponible en este momento, intente más tarde');
  }
  if (err && err.code === 11000) {
    return fail(res, 409, 'ya existe un registro con ese valor único');
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  return fail(res, 500, 'error interno, intente más tarde');
}

module.exports = { notFound, errorHandler };
