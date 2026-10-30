'use strict';

const Pedido = require('../models/pedido.model');
const { parseId, validateCart, validatePayment, validateStatus, parseOrderFilter } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

const badId = (res) => fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });

/** POST /api/v1/orders/reservations (RF05): reserva el stock del carrito por 10 minutos. */
async function reserve(req, res) {
  const { errors, data } = validateCart(req.body);
  if (errors.length) return fail(res, 400, errors);
  return ok(res, await Pedido.reserve(req.user, data.items), 201);
}

/** DELETE /api/v1/orders/reservations/:id: el cliente cancela y libera el stock. */
async function cancelReservation(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  await Pedido.cancelReserva(req.user, id);
  return ok(res, { id_reserva: id, cancelada: true });
}

/** POST /api/v1/orders/reservations/:id/pay (RF06): paga la reserva y crea el pedido. */
async function pay(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validatePayment(req.body);
  if (errors.length) return fail(res, 400, errors);
  return ok(res, await Pedido.pay(req.user, id, data.numero_tarjeta), 201);
}

/** GET /api/v1/orders/mine (RF07): historial del cliente. */
async function mine(req, res) {
  return ok(res, await Pedido.findMine(req.user));
}

/** GET /api/v1/orders/:id: el dueño o un administrador. */
async function getById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  return ok(res, await Pedido.findOne(req.user, id));
}

/** GET /api/v1/orders?estado= (RF18): todos los pedidos, solo administrador. */
async function list(req, res) {
  const { errors, estado } = parseOrderFilter(req.query);
  if (errors.length) return fail(res, 400, errors);
  return ok(res, await Pedido.findAll({ estado }));
}

/** PATCH /api/v1/orders/:id/status (RF18) */
async function setStatus(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateStatus(req.body);
  if (errors.length) return fail(res, 400, errors);
  return ok(res, await Pedido.setStatus(id, data.estado));
}

module.exports = { reserve, cancelReservation, pay, mine, getById, list, setStatus };
