'use strict';

/**
 * Aplica los archivos de migrations/ en orden (esquema y datos de prueba).
 *   npm run db:migrate   -> aplica las migraciones
 *   npm run db:reset     -> borra las tablas del proyecto y las vuelve a crear con datos de prueba
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConnectionConfig } = require('../src/config/database.config');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
// De las tablas hijas a las padres, para poder borrarlas sin romper las llaves foráneas
const TABLES = [
  'respaldo_insumo', 'pago', 'detalle_pedido', 'pedido', 'receta',
  'producto', 'insumo', 'cliente', 'administrador', 'usuario',
];

async function main() {
  const reset = process.argv.includes('--reset');
  // Solo este script usa multipleStatements: los archivos .sql traen muchas sentencias.
  const conn = await mysql.createConnection(getConnectionConfig({ multipleStatements: true }));
  try {
    if (reset) {
      console.log('Borrando tablas del proyecto...');
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of TABLES) {
        await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`Aplicando ${file}...`);
      await conn.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
    console.log('Listo: base de datos creada.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Error al migrar:', err.message);
  if (!process.argv.includes('--reset')) {
    console.error('Si las tablas ya existen, usa: npm run db:reset');
  }
  process.exit(1);
});
