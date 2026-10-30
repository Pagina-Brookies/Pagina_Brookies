'use strict';

/**
 * Ejecuta en orden las 13 consultas (en MQL) sobre una base de PRUEBA y muestra el resultado de cada una.
 * Por seguridad trabaja sobre la base "<MONGODB_DB>_consultas": la crea desde data/seed.json y no toca la real.
 * Uso:  npm run queries
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BSON } = require('mongodb');

process.env.MONGODB_DB = `${process.env.MONGODB_DB || 'brookies'}_consultas`;
const { connect, close, col, ensureIndexes } = require('../src/config/mongo');
const { consultas } = require('../src/queries/mql');

async function main() {
  const db = await connect();
  await db.dropDatabase();
  const data = BSON.EJSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));
  for (const name of ['usuarios', 'insumos', 'productos', 'pedidos', 'reservas']) await col(name).insertMany(data[name]);
  await ensureIndexes();

  for (const c of consultas) {
    console.log(`\n=== Consulta ${String(c.n).padStart(2, '0')} | ${c.tipo} | ${c.rf} | ${c.titulo}`);
    console.log(c.texto);
    const res = await c.run();
    const txt = JSON.stringify(res, (k, v) => (typeof v === 'bigint' ? Number(v) : v));
    console.log('-> resultado:', txt.length > 700 ? `${txt.slice(0, 700)}...` : txt);
  }
  await db.dropDatabase();
  console.log('\nBase de prueba eliminada.');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(close);
