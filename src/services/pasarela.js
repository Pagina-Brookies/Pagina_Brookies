'use strict';

const crypto = require('crypto');

/**
 * Pasarela de pago simulada (sandbox), con el mismo contrato que tendría una real (Webpay):
 * recibe el número solo para decidir el resultado y devuelve un código de autorización.
 * El número NO se guarda en ningún lugar (RNF01). Un número que termina en 0002 se rechaza.
 * Para pasar a una pasarela real solo hay que reemplazar esta función; el resto del sistema no cambia.
 */
async function authorize({ numero_tarjeta, monto }) {
  if (!Number.isInteger(monto) || monto <= 0) throw new Error('monto inválido');
  if (numero_tarjeta.endsWith('0002')) {
    return { aprobado: false, motivo: 'tarjeta rechazada por el emisor' };
  }
  return { aprobado: true, codigo: crypto.randomBytes(4).toString('hex').toUpperCase() };
}

module.exports = { authorize };
