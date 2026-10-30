'use strict';

/**
 * Exporta las tablas necesarias para el álgebra relacional al formato de grupo de RelaX
 * (https://dbis-uibk.github.io/relax/). Ejecutar justo después de npm run db:reset,
 * para que los datos sean los de prueba originales.
 *   npm run export:relax
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConnectionConfig } = require('../src/config/database.config');

const OUT = path.join(__dirname, '..', 'docs', 'algebra_relacional', 'brookies.relax.txt');
const TABLES = ['producto', 'insumo', 'receta', 'pedido', 'detalle_pedido', 'pago'];

function literal(v) {
  if (v === null || v === undefined) return "''";
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, ' ')}'`; // RelaX no usa comillas escapadas: se evita el apóstrofo
}

async function main() {
  const conn = await mysql.createConnection(getConnectionConfig());
  try {
    const lines = [
      'group:Brookies Coffee',
      'description:Datos de prueba — Brookies Coffee (Grupo 20, ICI-324). Corresponde a migrations/002_seed.sql.',
      '',
    ];
    for (const table of TABLES) {
      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      const cols = Object.keys(rows[0]);
      lines.push(`${table} = {`, `    ${cols.join(', ')}`);
      for (const r of rows) lines.push(`    ${cols.map((c) => literal(r[c])).join(', ')}`);
      lines.push('}', '');
    }
    fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
    console.log(`Archivo de RelaX escrito en ${path.relative(process.cwd(), OUT)}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Error al exportar:', err.message);
  process.exit(1);
});
