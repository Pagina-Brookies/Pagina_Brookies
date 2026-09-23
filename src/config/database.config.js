'use strict';

const fs = require('fs');
require('dotenv').config();

/**
 * Opciones SSL para la conexión. Aiven exige SSL; en local no hace falta.
 * El certificado CA se entrega por ruta (DB_SSL_CA) o por contenido (DB_SSL_CA_CONTENT).
 */
function sslOptions() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  let ca;
  if (process.env.DB_SSL_CA_CONTENT) {
    ca = process.env.DB_SSL_CA_CONTENT.replace(/\\n/g, '\n');
  } else if (process.env.DB_SSL_CA) {
    ca = fs.readFileSync(process.env.DB_SSL_CA, 'utf8');
  }
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
}

/** Configuración de conexión leída desde variables de entorno (nada queda escrito en el código). */
function getConnectionConfig(extra = {}) {
  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${missing.join(', ')}. Copia .env.example a .env y complétalo.`
    );
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    ssl: sslOptions(),
    decimalNumbers: true, // DECIMAL como número y no como texto
    dateStrings: true, // fechas como texto 'YYYY-MM-DD HH:MM:SS'
    ...extra,
  };
}

module.exports = { getConnectionConfig };
