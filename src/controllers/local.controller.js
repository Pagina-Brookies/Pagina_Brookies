'use strict';

const { ok } = require('../utils/respond');

/**
 * GET /api/v1/local (RF17): datos públicos del local. Se leen de variables de entorno para que el dueño
 * los cambie sin tocar el código; si no están definidas se usan los valores de ejemplo.
 */
function info(req, res) {
  return ok(res, {
    nombre: 'Brookies Coffee',
    direccion: process.env.LOCAL_DIRECCION || 'Junto a la Copec de Av. Borgoño 25175, Concón',
    // el local todavía no abre: el mapa marca la Copec de Concón junto a la que estará. LOCAL_ABIERTO=true quita el aviso
    mapa: {
      consulta: process.env.LOCAL_MAPA || 'COPEC, Av. Borgoño 25175, Concón, Valparaíso, Chile',
      referencial: process.env.LOCAL_ABIERTO !== 'true',
    },
    telefono: process.env.LOCAL_TELEFONO || '+56 9 1111 1111',
    correo_contacto: process.env.LOCAL_CORREO || 'contacto@brookies.example',
    horarios: [
      { dias: 'Lunes a viernes', horario: process.env.LOCAL_HORARIO_SEMANA || '08:30 a 19:00' },
      { dias: 'Sábado y domingo', horario: process.env.LOCAL_HORARIO_FINDE || '10:00 a 18:00' },
    ],
  });
}

module.exports = { info };
