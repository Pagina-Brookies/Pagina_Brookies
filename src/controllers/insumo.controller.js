'use strict';

const Insumo = require('../models/insumo.model');
const { parseId, validateInsumoCreate, validateInsumoUpdate, validateRestock } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

const badId = (res) => fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });

/** GET /api/v1/supplies?critical=true (RF13) */
async function list(req, res) {
  const raw = req.query.critical;
  if (raw !== undefined && raw !== 'true' && raw !== 'false') return fail(res, 400, { field: 'critical', message: 'debe ser true o false' });
  return ok(res, await Insumo.findAll({ critical: raw === 'true' }));
}

async function getById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const s = await Insumo.findById(id);
  return s ? ok(res, s) : fail(res, 404, 'insumo no existe');
}

/** POST /api/v1/supplies (RF11) */
async function create(req, res) {
  const { errors, data } = validateInsumoCreate(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (await Insumo.nameExists(data.nombre)) return fail(res, 409, `ya existe un insumo llamado "${data.nombre}"`);
  return ok(res, await Insumo.create(data), 201);
}

/** PATCH /api/v1/supplies/:id/restock (RF14) */
async function restock(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateRestock(req.body);
  if (errors.length) return fail(res, 400, errors);
  const s = await Insumo.restock(id, data.cantidad);
  return s ? ok(res, s) : fail(res, 404, 'insumo no existe');
}

/** PUT /api/v1/supplies/:id (RF11) */
async function update(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateInsumoUpdate(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (await Insumo.nameExists(data.nombre, id)) return fail(res, 409, `ya existe otro insumo llamado "${data.nombre}"`);
  const s = await Insumo.update(id, data);
  return s ? ok(res, s) : fail(res, 404, 'insumo no existe');
}

/** DELETE /api/v1/supplies/:id (RF11). Mongo no tiene FK: el servicio revisa que ninguna receta lo use. */
async function remove(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  if (await Insumo.inUse(id)) return fail(res, 409, 'no se puede eliminar: está en la receta de uno o más productos. Quítelo de esas recetas primero.');
  return (await Insumo.remove(id)) ? ok(res, { id_insumo: id, eliminado: true }) : fail(res, 404, 'insumo no existe');
}

module.exports = { list, getById, create, restock, update, remove };
