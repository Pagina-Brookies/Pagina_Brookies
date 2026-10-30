'use strict';

/**
 * Ejecuta desde la aplicación las 13 consultas SQL de queries/ (según queries/manifest.json).
 *   npm run db:reset     (deja la base con los datos de prueba originales)
 *   npm run queries      (ejecuta y muestra los resultados en pantalla)
 *   npm run queries:md   (además escribe docs/resultados_consultas.md)
 *
 * Todos los valores viajan como parámetros (?), nunca concatenados en el SQL.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getConnectionConfig } = require('../src/config/database.config');

const QUERIES_DIR = path.join(__dirname, '..', 'queries');
const RESULTS_MD = path.join(__dirname, '..', 'docs', 'resultados_consultas.md');
const manifest = require('../queries/manifest.json');
const writeMd = process.argv.includes('--md');

function cell(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\|/g, '\\|');
}

function mdTable(rows) {
  if (rows.length === 0) return '_(sin filas)_\n';
  const cols = Object.keys(rows[0]);
  const head = `| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |\n`;
  return head + rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`).join('\n') + '\n';
}

function show(rows) {
  if (rows.length === 0) console.log('  (sin filas)');
  else console.table(rows);
}

/** Deja la base lista para que el script se pueda ejecutar más de una vez. */
async function cleanBeforeRun(conn) {
  await conn.query('DROP TABLE IF EXISTS respaldo_insumo');
  const [idx] = await conn.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'producto' AND index_name = 'idx_producto_categoria'`
  );
  if (idx.length > 0) await conn.query('ALTER TABLE producto DROP INDEX idx_producto_categoria');
  await conn.query(fs.readFileSync(path.join(QUERIES_DIR, '00_preparacion_respaldo.sql'), 'utf8'));
}

async function main() {
  const conn = await mysql.createConnection(getConnectionConfig());
  const md = ['# Resultados de las 13 consultas SQL', '',
    'Generado con `npm run queries:md` sobre los datos de prueba (`migrations/002_seed.sql`).',
    'Las consultas se ejecutan en orden y los cambios de cada una se ven en las siguientes.', ''];
  try {
    await cleanBeforeRun(conn);
    for (const q of manifest) {
      const sql = fs.readFileSync(path.join(QUERIES_DIR, q.file), 'utf8');
      console.log(`\n=== Consulta ${String(q.id).padStart(2, '0')} · ${q.tipo} · ${q.titulo}`);
      console.log(`    archivo: queries/${q.file}   parámetros: ${JSON.stringify(q.params)}`);
      md.push(`## Consulta ${String(q.id).padStart(2, '0')} · ${q.tipo}`, '', `${q.titulo}.`, '',
        `Parámetros: \`${JSON.stringify(q.params)}\``, '', '```sql', sql.trim(), '```', '');

      const [result] = await conn.execute(sql, q.params);
      if (Array.isArray(result)) {
        show(result);
        md.push('Resultado:', '', mdTable(result));
      } else {
        console.log(`  OK · filas afectadas: ${result.affectedRows}`);
        md.push(`Resultado: OK, filas afectadas: ${result.affectedRows}.`, '');
      }

      if (q.verificacion) {
        const [rows] = await conn.execute(q.verificacion.sql, q.verificacion.params);
        console.log('  Verificación:');
        show(rows);
        md.push('Verificación (consulta adicional, no cuenta entre las 13):', '', mdTable(rows));
      }
    }
    console.log(`\n${manifest.length} consultas ejecutadas correctamente.`);
    if (writeMd) {
      fs.writeFileSync(RESULTS_MD, md.join('\n'), 'utf8');
      console.log(`Resultados escritos en ${path.relative(process.cwd(), RESULTS_MD)}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nLa consulta falló:', err.message);
  console.error('Sugerencia: ejecuta primero npm run db:reset para partir de los datos originales.');
  process.exit(1);
});
