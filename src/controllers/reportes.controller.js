'use strict';

const Reportes = require('../models/reportes.model');
const { ok } = require('../utils/respond');

/** GET /api/v1/reports/top-products — RF16: productos más vendidos (consulta 04). */
async function topProducts(req, res, next) {
  try {
    const rows = await Reportes.topProducts();
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/v1/reports/critical-supplies — RF13/RF16: insumos críticos y sus productos (consulta 05). */
async function criticalSupplies(req, res, next) {
  try {
    const rows = await Reportes.criticalSupplies();
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

module.exports = { topProducts, criticalSupplies };
