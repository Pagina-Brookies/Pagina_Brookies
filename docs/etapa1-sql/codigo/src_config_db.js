'use strict';

const mysql = require('mysql2/promise');
const { getConnectionConfig } = require('./database.config');

let pool = null;

/** Pool de conexiones (se crea la primera vez que se usa). */
function getPool() {
  if (!pool) {
    pool = mysql.createPool(
      getConnectionConfig({ waitForConnections: true, connectionLimit: 10, queueLimit: 0 })
    );
  }
  return pool;
}

/** Ejecuta una consulta parametrizada (sentencia preparada) y devuelve las filas. */
async function execute(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, execute, closePool };
