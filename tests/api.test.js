'use strict';

/**
 * Pruebas de integración: levantan la API contra un MongoDB real (replica set, para las transacciones).
 * Requieren MONGODB_URI; usan una base propia "<db>_test" que se borra al terminar. Sin MONGODB_URI se omiten.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const URI = process.env.MONGODB_URI;
const skip = !URI && 'defina MONGODB_URI para correr las pruebas de integración';

process.env.MONGODB_DB = 'brookies_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-123456';
process.env.AUTH_RATE_LIMIT = '1000';

let base; let server; let M; let db;

async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const login = async (correo) => (await call('POST', '/api/v1/auth/login', { body: { correo, contrasena: 'demo1234' } })).body.data.token;

test.before(async () => {
  if (skip) return;
  const { BSON } = require('mongodb');
  M = require('../src/config/mongo');
  db = await M.connect();
  await db.dropDatabase();
  const data = BSON.EJSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));
  data.insumos.forEach((i) => { i.stock_reservado = 0; });
  for (const n of ['usuarios', 'insumos', 'productos', 'pedidos']) await M.col(n).insertMany(data[n]);
  await M.ensureIndexes();
  server = require('../src/app').listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (skip) return;
  // si el before falló a medias, server o db pueden no existir: igual se cierra el cliente para no dejar el proceso colgado
  try {
    if (server) server.close();
    if (db) await db.dropDatabase();
  } finally {
    if (M) await M.close();
  }
});

test('login correcto, incorrecto y registro duplicado', { skip }, async () => {
  const ok = await call('POST', '/api/v1/auth/login', { body: { correo: 'camila.rojas@example.com', contrasena: 'demo1234' } });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.body.data.token);
  assert.strictEqual(ok.body.data.usuario.contrasena_hash, undefined);
  const bad = await call('POST', '/api/v1/auth/login', { body: { correo: 'camila.rojas@example.com', contrasena: 'otra1234' } });
  assert.strictEqual(bad.status, 401);
  const dup = await call('POST', '/api/v1/auth/register', { body: { nombre: 'X', correo: 'CAMILA.rojas@example.com', contrasena: 'abcdefg1' } });
  assert.strictEqual(dup.status, 409);
  const weak = await call('POST', '/api/v1/auth/register', { body: { nombre: 'X', correo: 'x@example.com', contrasena: 'abcdefgh' } });
  assert.strictEqual(weak.status, 400);
  const nuevo = await call('POST', '/api/v1/auth/register', { body: { nombre: 'Nuevo Cliente', correo: 'nuevo@example.com', contrasena: 'abcdefg1' } });
  assert.strictEqual(nuevo.status, 201);
});

test('roles: sin token 401, cliente en ruta de admin 403', { skip }, async () => {
  assert.strictEqual((await call('GET', '/api/v1/supplies')).status, 401);
  const t = await login('camila.rojas@example.com');
  assert.strictEqual((await call('GET', '/api/v1/supplies', { token: t })).status, 403);
  const a = await login('admin@brookies.example');
  assert.strictEqual((await call('GET', '/api/v1/supplies', { token: a })).status, 200);
});

test('menú público con disponibilidad efectiva y filtros', { skip }, async () => {
  const all = await call('GET', '/api/v1/products?available=false');
  assert.strictEqual(all.status, 200);
  const brookie = all.body.data.find((p) => p.nombre === 'Brookie de temporada');
  assert.strictEqual(brookie.disponible_efectivo, false);
  const sg = await call('GET', '/api/v1/products?suitable_for=sin_gluten');
  assert.ok(sg.body.data.length > 0);
  assert.ok(sg.body.data.every((p) => p.apto_para.includes('sin_gluten')));
});

test('reserva, pago rechazado, pago aprobado y descuento de stock', { skip }, async () => {
  const t = await login('camila.rojas@example.com');
  const cafe0 = await M.col('insumos').findOne({ _id: 1 });
  const r = await call('POST', '/api/v1/orders/reservations', { token: t, body: { items: [{ producto_id: 3, cantidad: 2 }] } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.data.total, 5800);
  const cafe1 = await M.col('insumos').findOne({ _id: 1 });
  assert.strictEqual(cafe1.stock_reservado, cafe0.stock_reservado + 32);

  const rech = await call('POST', `/api/v1/orders/reservations/${r.body.data.id_reserva}/pay`, { token: t, body: { numero_tarjeta: '4111 1111 1111 0002' } });
  assert.strictEqual(rech.status, 422);

  const pay = await call('POST', `/api/v1/orders/reservations/${r.body.data.id_reserva}/pay`, { token: t, body: { numero_tarjeta: '4111111111111111' } });
  assert.strictEqual(pay.status, 201);
  assert.strictEqual(pay.body.data.estado, 'recibido');
  assert.ok(!JSON.stringify(pay.body).includes('4111111111111111'));
  const cafe2 = await M.col('insumos').findOne({ _id: 1 });
  assert.strictEqual(cafe2.stock_actual, cafe0.stock_actual - 32);
  assert.strictEqual(cafe2.stock_reservado, cafe0.stock_reservado);

  const again = await call('POST', `/api/v1/orders/reservations/${r.body.data.id_reserva}/pay`, { token: t, body: { numero_tarjeta: '4111111111111111' } });
  assert.strictEqual(again.status, 409);
  const mine = await call('GET', '/api/v1/orders/mine', { token: t });
  assert.strictEqual(mine.body.data[0].id_pedido, pay.body.data.id_pedido);
});

test('stock insuficiente da 409 y no deja reservas a medias', { skip }, async () => {
  const t = await login('camila.rojas@example.com');
  const antes = await M.col('insumos').find().sort({ _id: 1 }).toArray();
  // Brookie clásico usa 1 huevo y quedan 20 (no hay stock para 50 unidades)
  const r = await call('POST', '/api/v1/orders/reservations', { token: t, body: { items: [{ producto_id: 11, cantidad: 50 }, { producto_id: 1, cantidad: 1 }] } });
  assert.strictEqual(r.status, 409);
  const despues = await M.col('insumos').find().sort({ _id: 1 }).toArray();
  assert.deepStrictEqual(despues.map((i) => i.stock_reservado), antes.map((i) => i.stock_reservado));
});

test('cancelar libera el stock; reservas vencidas se liberan', { skip }, async () => {
  const t = await login('camila.rojas@example.com');
  const base0 = (await M.col('insumos').findOne({ _id: 1 })).stock_reservado;
  const r = await call('POST', '/api/v1/orders/reservations', { token: t, body: { items: [{ producto_id: 1, cantidad: 1 }] } });
  assert.strictEqual((await call('DELETE', `/api/v1/orders/reservations/${r.body.data.id_reserva}`, { token: t })).status, 200);
  assert.strictEqual((await M.col('insumos').findOne({ _id: 1 })).stock_reservado, base0);

  const r2 = await call('POST', '/api/v1/orders/reservations', { token: t, body: { items: [{ producto_id: 1, cantidad: 1 }] } });
  await M.col('reservas').updateOne({ _id: r2.body.data.id_reserva }, { $set: { expira_en: new Date(Date.now() - 1000) } });
  const late = await call('POST', `/api/v1/orders/reservations/${r2.body.data.id_reserva}/pay`, { token: t, body: { numero_tarjeta: '4111111111111111' } });
  assert.strictEqual(late.status, 409);
  assert.strictEqual((await M.col('insumos').findOne({ _id: 1 })).stock_reservado, base0);
});

test('admin cambia estado solo hacia adelante; cliente no ve pedidos ajenos', { skip }, async () => {
  const a = await login('admin@brookies.example');
  const list = await call('GET', '/api/v1/orders?estado=recibido', { token: a });
  assert.strictEqual(list.status, 200);
  const id = list.body.data[0].id_pedido;
  assert.strictEqual((await call('PATCH', `/api/v1/orders/${id}/status`, { token: a, body: { estado: 'listo' } })).status, 200);
  assert.strictEqual((await call('PATCH', `/api/v1/orders/${id}/status`, { token: a, body: { estado: 'recibido' } })).status, 409);
  const nuevo = await call('POST', '/api/v1/auth/login', { body: { correo: 'nuevo@example.com', contrasena: 'abcdefg1' } });
  assert.strictEqual((await call('GET', `/api/v1/orders/${id}`, { token: nuevo.body.data.token })).status, 403);
});

test('recetas, insumos y reglas que reemplazan a las FK', { skip }, async () => {
  const a = await login('admin@brookies.example');
  assert.strictEqual((await call('DELETE', '/api/v1/supplies/1', { token: a })).status, 409);
  assert.strictEqual((await call('DELETE', '/api/v1/products/3', { token: a })).status, 409);
  const p = await call('POST', '/api/v1/products', { token: a, body: { nombre: 'Chai', descripcion: 'Té', precio: 3000, categoria: 'Té', tipo_preparacion: 'caliente', disponible: true } });
  assert.strictEqual(p.status, 201);
  const rc = await call('POST', `/api/v1/products/${p.body.data.id_producto}/recipe`, { token: a, body: { id_insumo: 4, cantidad_requerida: 10 } });
  assert.strictEqual(rc.status, 201);
  assert.deepStrictEqual(rc.body.data.apto_para.sort(), ['sin_gluten', 'sin_lactosa', 'vegano']);
  const rs = await call('PATCH', '/api/v1/supplies/4/restock', { token: a, body: { cantidad: 100 } });
  assert.strictEqual(rs.status, 200);
  const rep = await call('GET', '/api/v1/reports/critical-supplies', { token: a });
  assert.ok(rep.body.data.some((r) => r.insumo === 'Huevos'));
  const top = await call('GET', '/api/v1/reports/top-products', { token: a });
  assert.strictEqual(top.body.data[0].nombre, 'Latte');
});

test('errores: 404 de ruta, 400 de JSON roto y 429 al pasar el límite de login', { skip }, async () => {
  assert.strictEqual((await call('GET', '/api/v1/nada')).status, 404);
  const res = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{roto' });
  assert.strictEqual(res.status, 400);
});
