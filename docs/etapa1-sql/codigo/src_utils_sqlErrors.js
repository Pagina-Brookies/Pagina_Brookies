'use strict';

/**
 * Traduce un error de MySQL a { status, message } listo para el usuario.
 * Devuelve null si no es un error de datos que sepamos explicar (ese caso
 * lo toma el manejador genérico y responde 500).
 */
function mapSqlError(err, context = {}) {
  if (!err || !err.code) return null;

  switch (err.code) {
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      if (context.checkMessages) {
        for (const [needle, message] of Object.entries(context.checkMessages)) {
          if (err.sqlMessage && err.sqlMessage.includes(needle)) return { status: 422, message };
        }
      }
      return { status: 422, message: 'el valor no cumple una restricción de la base de datos (revise cantidades y montos)' };
    }
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW':
      return { status: 400, message: context.fkMessage || 'hace referencia a un registro que no existe' };
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED':
      return { status: 409, message: context.restrictMessage || 'no se puede eliminar: está en uso por otro registro' };
    case 'ER_DUP_ENTRY':
      return { status: 409, message: context.dupMessage || 'ya existe un registro con ese valor único' };
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return { status: 422, message: 'el valor resultante excede el máximo que la base de datos puede guardar' };
    case 'ER_DATA_TOO_LONG':
      return { status: 400, message: 'un valor supera el largo permitido para ese campo' };
    case 'ER_BAD_NULL_ERROR':
      return { status: 400, message: 'falta un campo obligatorio' };
    default:
      return null;
  }
}

module.exports = { mapSqlError };
