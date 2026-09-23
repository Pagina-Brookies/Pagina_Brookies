'use strict';

const Insumo = require('../models/insumo.model');
const { ok, fail } = require('../utils/respond');

/** GET /api/v1/supplies?critical=true - inventario de insumos. */
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

module.exports = { list };
