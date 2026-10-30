'use strict';

/**
 * Carga los datos de demostración (data/seed.json) en la base. BORRA las colecciones del sistema y las vuelve a crear.
 * Uso:  npm run db:seed        (usa MONGODB_URI y MONGODB_DB del entorno o del archivo .env)
 * Cuentas de prueba: admin@brookies.example y ignacia.valdebenito@clientes.brookies.example, contraseña demo1234.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BSON } = require('mongodb');
const { connect, close, col, ensureIndexes, COLLECTIONS } = require('../src/config/mongo');

async function main() {
  const db = await connect();
  const data = BSON.EJSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));

  for (const name of [...COLLECTIONS, 'respaldo_insumo']) await col(name).drop().catch(() => {});

  // la reserva de ejemplo se fecha ahora, para que se vea como una reserva reciente
  const ahora = Date.now();
  data.reservas.forEach((r) => { r.creada_en = new Date(ahora); r.expira_en = new Date(ahora + 10 * 60000); });
  data.insumos.forEach((i) => { i.stock_reservado = 0; });
  for (const r of data.reservas) {
    for (const c of r.insumos) data.insumos.find((i) => i._id === c.insumo_id).stock_reservado += c.cantidad;
  }

  for (const name of ['usuarios', 'insumos', 'productos', 'pedidos', 'reservas']) {
    await col(name).insertMany(data[name]);
  }
  await ensureIndexes();
  for (const name of ['usuarios', 'insumos', 'productos', 'pedidos', 'reservas']) {
    console.log(name.padEnd(10), await col(name).countDocuments(), 'documentos');
  }
  console.log(`Base "${db.databaseName}" lista.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(close);
