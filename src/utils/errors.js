'use strict';

/**
 * Error de regla de negocio o de datos que se explica al usuario con un código HTTP.
 * El manejador de errores lo convierte en { data: null, errors: [...] } con ese estado.
 */
class HttpError extends Error {
  constructor(status, errors) {
    super(Array.isArray(errors) ? errors.map((e) => e.message || e).join('; ') : String(errors.message || errors));
    this.status = status;
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
}

module.exports = { HttpError };
