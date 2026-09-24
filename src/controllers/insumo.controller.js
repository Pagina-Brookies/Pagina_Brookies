'use strict';

const Insumo = require('../models/insumo.model');
const { parseId, validateInsumoCreate, validateRestock } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');
const { mapSqlError } = require('../utils/sqlErrors');

/** GET /api/v1/supplies?critical=true — inventario de insumos. */
async function list(req, res, next) {
  try {
    const raw = req.query.critical;
    if (raw !== undefined && raw !== 'true' && raw !== 'false') {
      return fail(res, 400, { field: 'critical', message: 'debe ser true o false' });
    }
    const supplies = await Insumo.findAll({ critical: raw === 'true' });
    return ok(res, supplies);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/v1/supplies/:id — un insumo. */
async function getById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });
    const supply = await Insumo.findById(id);
    if (!supply) return fail(res, 404, 'insumo no existe');
    return ok(res, supply);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/v1/supplies — RF11: registrar insumo. */
async function create(req, res, next) {
  try {
    const { errors, data } = validateInsumoCreate(req.body);
    if (errors.length > 0) return fail(res, 400, errors);
    const supply = await Insumo.create(data);
    return ok(res, supply, 201);
  } catch (err) {
    const mapped = mapSqlError(err, {
      checkMessages: {
        ck_insumo_stock_actual: 'el stock actual no puede ser negativo',
        ck_insumo_stock_minimo: 'el stock mínimo no puede ser negativo',
      },
    });
    if (mapped) return fail(res, mapped.status, mapped.message);
    return next(err);
  }
}

/** PATCH /api/v1/supplies/:id/restock — RF14: reabastecer stock. */
async function restock(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });

    const { errors, data } = validateRestock(req.body);
    if (errors.length > 0) return fail(res, 400, errors);

    const supply = await Insumo.restock(id, data.cantidad);
    if (!supply) return fail(res, 404, 'insumo no existe');
    return ok(res, supply);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById, create, restock };
