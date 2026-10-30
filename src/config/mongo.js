'use strict';

const { MongoClient } = require('mongodb');

let client = null;
let database = null;

/**
 * Conecta a MongoDB. La cadena de conexión viene de MONGODB_URI (nunca escrita en el código).
 * En Atlas es una URI mongodb+srv://; en local sirve mongodb://127.0.0.1:27017.
 */
async function connect(uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB || 'brookies') {
  if (database) return database;
  if (!uri) {
    throw new Error('Falta la variable de entorno MONGODB_URI. Defínela en el archivo .env.');
  }
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  database = client.db(dbName);
  return database;
}

function getDb() {
  if (!database) throw new Error('La base de datos no está conectada: llame a connect() primero.');
  return database;
}

const col = (name) => getDb().collection(name);

async function close() {
  if (client) await client.close();
  client = null;
  database = null;
}

/** Colación para comparar nombres sin importar mayúsculas ni tildes ("cafe" = "Café"). */
const LOOSE = { locale: 'es', strength: 1 };

/**
 * Siguiente _id entero de una colección. Se mantiene el mismo entero que tenía el modelo relacional
 * (correspondencia 1 a 1 con las tablas); un contador atómico en la colección counters evita repetidos
 * aunque dos clientes creen algo al mismo tiempo.
 */
async function nextId(name, session) {
  const opts = { upsert: true, returnDocument: 'after', session };
  let doc = await col('counters').findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, opts);
  if (doc.seq === 1) {
    // contador nuevo: si la colección ya tiene documentos, partir desde su mayor _id
    const top = await col(name).find({}, { session }).sort({ _id: -1 }).limit(1).next();
    if (top && top._id >= doc.seq) {
      doc = await col('counters').findOneAndUpdate({ _id: name }, { $set: { seq: top._id + 1 } }, opts);
    }
  }
  return doc.seq;
}

/**
 * Ejecuta fn dentro de una transacción multi-documento (Atlas la soporta). Con MONGO_TX=off se ejecuta
 * sin transacción, para servidores que no la tienen; en ese caso las operaciones que tocan varios
 * documentos se compensan a mano (ver pedido.model.js).
 */
async function withTx(fn) {
  if (String(process.env.MONGO_TX).toLowerCase() === 'off') return fn(undefined);
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    return result;
  } finally {
    await session.endSession();
  }
}

const COLLECTIONS = ['usuarios', 'productos', 'insumos', 'pedidos', 'reservas', 'counters'];

/** Crea las colecciones y los índices del diseño (sección 7.5 del informe). Se puede repetir sin problema. */
async function ensureIndexes() {
  const db = getDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) await db.createCollection(name);
  }
  await col('usuarios').createIndex({ correo: 1 }, { unique: true });
  await col('productos').createIndex({ nombre: 1 }, { unique: true });
  await col('insumos').createIndex({ nombre: 1 }, { unique: true });
  await col('productos').createIndex({ categoria: 1, disponible: 1, precio: 1 });
  await col('productos').createIndex({ apto_para: 1 });
  await col('productos').createIndex({ 'receta.insumo_id': 1 });
  await col('pedidos').createIndex({ 'cliente._id': 1, fecha: -1 });
  await col('pedidos').createIndex({ estado: 1, fecha: -1 });
  await col('reservas').createIndex({ estado: 1, expira_en: 1 });
}

module.exports = { connect, getDb, col, close, nextId, withTx, ensureIndexes, LOOSE, COLLECTIONS };
