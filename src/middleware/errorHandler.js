'use strict';

const { fail } = require('../utils/respond');

// Errores que indican que la base de datos no está alcanzable (apagada, sin red, DNS),
// no que la petición esté mal. Se responden como 503 para distinguirlos de un bug.
const DB_DOWN_CODES = new Set([
  'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EAI_AGAIN',
]);

function notFound(req, res) {
  return fail(res, 404, `ruta no encontrada: ${req.method} ${req.originalUrl}`);
}

// Al usuario se le muestra un mensaje genérico; el detalle técnico queda en el registro.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'el cuerpo de la petición no es un JSON válido (revise comillas y comas)');
  }
  if (err && err.type === 'entity.too.large') {
    return fail(res, 413, 'el cuerpo de la petición es demasiado grande');
  }
  if (err && DB_DOWN_CODES.has(err.code)) {
    console.error(`[db] ${req.method} ${req.originalUrl}: base de datos no disponible (${err.code})`);
    return fail(res, 503, 'la base de datos no está disponible en este momento, intente más tarde');
  }
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  return fail(res, 500, 'error interno, intente más tarde');
}

module.exports = { notFound, errorHandler };
