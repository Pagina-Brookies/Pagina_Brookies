'use strict';

const { col, nextId, withTx } = require('../config/mongo');
const { HttpError } = require('../utils/errors');
const Producto = require('./producto.model');
const pasarela = require('../services/pasarela');

const RESERVA_MIN = Number(process.env.RESERVA_MINUTOS) || 10;

const totalDe = (items) => items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

function toReserva(r) {
  return {
    id_reserva: r._id,
    estado: r.estado,
    total: totalDe(r.items),
    expira_en: r.expira_en,
    items: r.items.map((i) => ({ id_producto: i.producto_id, nombre: i.nombre, precio_unitario: i.precio_unitario, cantidad: i.cantidad })),
  };
}

function toPedido(p) {
  return {
    id_pedido: p._id,
    fecha: p.fecha,
    estado: p.estado,
    total: p.total,
    cliente: { id_usuario: p.cliente._id, nombre: p.cliente.nombre },
    items: p.items.map((i) => ({
      id_producto: i.producto_id, nombre: i.nombre, precio_unitario: i.precio_unitario, cantidad: i.cantidad, subtotal: i.precio_unitario * i.cantidad,
    })),
    pago: p.pago ? { monto: p.pago.monto, metodo_pago: p.pago.metodo_pago, estado_pago: p.pago.estado_pago, fecha_pago: p.pago.fecha_pago } : null,
  };
}

/** Suma el consumo de insumos de todo el carrito (un insumo puede estar en varios productos). */
function consumoDe(productos, items) {
  const porProducto = new Map(productos.map((p) => [p._id, p]));
  const consumo = new Map();
  for (const it of items) {
    for (const r of porProducto.get(it.producto_id).receta) {
      consumo.set(r.insumo_id, (consumo.get(r.insumo_id) || 0) + r.cantidad_requerida * it.cantidad);
    }
  }
  return [...consumo].map(([insumo_id, cantidad]) => ({ insumo_id, cantidad }));
}

/** Libera las reservas vencidas: devuelve el stock reservado y las marca como expiradas. */
async function releaseExpired() {
  const vencidas = await col('reservas').find({ estado: 'activa', expira_en: { $lt: new Date() } }).toArray();
  for (const r of vencidas) {
    await withTx(async (session) => {
      const res = await col('reservas').updateOne({ _id: r._id, estado: 'activa' }, { $set: { estado: 'expirada' } }, { session });
      if (res.modifiedCount === 1) await liberar(r.insumos, session);
    });
  }
  return vencidas.length;
}

async function liberar(consumo, session) {
  for (const c of consumo) {
    await col('insumos').updateOne({ _id: c.insumo_id }, { $inc: { stock_reservado: -c.cantidad } }, { session });
  }
}

/**
 * RF05: reserva el stock del carrito por RESERVA_MIN minutos. Cada insumo se reserva con un update
 * condicional (stock libre >= necesario), que es atómico: dos clientes no pueden quedarse con el último stock.
 */
async function reserve(user, items) {
  await releaseExpired();
  const ids = items.map((i) => i.producto_id);
  const productos = await Producto.findManyWithStock(ids);
  const errors = [];
  items.forEach((it, i) => {
    const p = productos.find((x) => x._id === it.producto_id);
    if (!p) errors.push({ field: `items[${i}].producto_id`, message: 'el producto no existe' });
    else if (!p.disponible_efectivo) errors.push({ field: `items[${i}].producto_id`, message: `${p.nombre} no está disponible por ahora` });
  });
  if (errors.length) throw new HttpError(409, errors);

  const consumo = consumoDe(productos, items);
  const lineas = items.map((it) => {
    const p = productos.find((x) => x._id === it.producto_id);
    return { producto_id: p._id, nombre: p.nombre, cantidad: it.cantidad, precio_unitario: p.precio };
  });
  const total = totalDe(lineas);

  return withTx(async (session) => {
    const aplicados = [];
    try {
      for (const c of consumo) {
        const res = await col('insumos').updateOne(
          { _id: c.insumo_id, $expr: { $gte: [{ $subtract: ['$stock_actual', { $ifNull: ['$stock_reservado', 0] }] }, c.cantidad] } },
          { $inc: { stock_reservado: c.cantidad } },
          { session }
        );
        if (res.modifiedCount !== 1) {
          throw new HttpError(409, { field: 'items', message: 'no queda stock suficiente para completar el pedido, reduzca las cantidades' });
        }
        aplicados.push(c);
      }
      const _id = await nextId('reservas', session);
      const doc = {
        _id, cliente: { _id: user._id, nombre: user.nombre }, items: lineas, insumos: consumo, estado: 'activa',
        creada_en: new Date(), expira_en: new Date(Date.now() + RESERVA_MIN * 60000),
      };
      await col('reservas').insertOne(doc, { session });
      return toReserva(doc);
    } catch (e) {
      if (!session) await liberar(aplicados); // sin transacción: se deshace a mano
      throw e;
    }
  });
}

async function ownReserva(user, id) {
  const r = await col('reservas').findOne({ _id: id });
  if (!r) throw new HttpError(404, { message: 'la reserva no existe' });
  if (r.cliente._id !== user._id) throw new HttpError(403, { message: 'la reserva pertenece a otro usuario' });
  return r;
}

/** Cancelar la reserva (el cliente vuelve atrás): libera el stock. */
async function cancelReserva(user, id) {
  const r = await ownReserva(user, id);
  if (r.estado !== 'activa') throw new HttpError(409, { message: `la reserva ya está ${r.estado}` });
  await withTx(async (session) => {
    const res = await col('reservas').updateOne({ _id: id, estado: 'activa' }, { $set: { estado: 'cancelada' } }, { session });
    if (res.modifiedCount === 1) await liberar(r.insumos, session);
  });
}

/**
 * RF06: pago. Si la pasarela aprueba, en una sola transacción se descuenta el stock real, se libera la reserva
 * y se crea el pedido (con el pago embebido). Si rechaza, la reserva sigue activa hasta que venza.
 */
async function pay(user, id, numero_tarjeta) {
  let r = await ownReserva(user, id);
  if (r.estado === 'activa' && r.expira_en < new Date()) {
    await releaseExpired();
    r = await ownReserva(user, id);
  }
  if (r.estado === 'expirada') throw new HttpError(409, { message: 'la reserva expiró, vuelva a armar el pedido' });
  if (r.estado !== 'activa') throw new HttpError(409, { message: `la reserva ya está ${r.estado}` });

  const total = totalDe(r.items);
  const auth = await pasarela.authorize({ numero_tarjeta, monto: total });
  if (!auth.aprobado) throw new HttpError(422, { field: 'numero_tarjeta', message: `pago rechazado: ${auth.motivo}. Pruebe con otra tarjeta` });

  return withTx(async (session) => {
    const marca = await col('reservas').updateOne({ _id: id, estado: 'activa' }, { $set: { estado: 'pagada' } }, { session });
    if (marca.modifiedCount !== 1) throw new HttpError(409, { message: 'la reserva ya no está activa' });
    for (const c of r.insumos) {
      await col('insumos').updateOne({ _id: c.insumo_id }, { $inc: { stock_actual: -c.cantidad, stock_reservado: -c.cantidad } }, { session });
    }
    const _id = await nextId('pedidos', session);
    const doc = {
      _id,
      cliente: { _id: user._id, nombre: user.nombre },
      fecha: new Date(),
      estado: 'recibido',
      items: r.items,
      total,
      pago: { monto: total, metodo_pago: 'tarjeta', token_transaccion: `tok_${auth.codigo}`, estado_pago: 'aprobado', fecha_pago: new Date() },
    };
    await col('pedidos').insertOne(doc, { session });
    return toPedido(doc);
  });
}

async function findMine(user) {
  const docs = await col('pedidos').find({ 'cliente._id': user._id }).sort({ fecha: -1 }).toArray();
  return docs.map(toPedido);
}

async function findAll({ estado }) {
  const docs = await col('pedidos').find(estado ? { estado } : {}).sort({ fecha: -1 }).limit(200).toArray();
  return docs.map(toPedido);
}

async function findOne(user, id) {
  const p = await col('pedidos').findOne({ _id: id });
  if (!p) throw new HttpError(404, { message: 'el pedido no existe' });
  if (user.rol !== 'administrador' && p.cliente._id !== user._id) throw new HttpError(403, { message: 'el pedido pertenece a otro usuario' });
  return toPedido(p);
}

/** RF18: el administrador avanza el estado. Solo hacia adelante: recibido, en_preparacion, listo. */
async function setStatus(id, estado) {
  const orden = ['recibido', 'en_preparacion', 'listo'];
  const p = await col('pedidos').findOne({ _id: id });
  if (!p) throw new HttpError(404, { message: 'el pedido no existe' });
  if (orden.indexOf(estado) < orden.indexOf(p.estado)) {
    throw new HttpError(409, { field: 'estado', message: `el pedido ya está ${p.estado}; no se puede volver a ${estado}` });
  }
  await col('pedidos').updateOne({ _id: id }, { $set: { estado } });
  return toPedido({ ...p, estado });
}

module.exports = { reserve, cancelReserva, pay, findMine, findAll, findOne, setStatus, releaseExpired };
