'use strict';

const Reportes = require('../models/reportes.model');
const { ok } = require('../utils/respond');
const { consultas } = require('../queries/mql');

/** GET /api/v1/reports/top-products (RF16, consulta 04) */
async function topProducts(req, res) {
  return ok(res, await Reportes.topProducts());
}

/** GET /api/v1/reports/critical-supplies (RF13/RF16, consulta 05) */
async function criticalSupplies(req, res) {
  return ok(res, await Reportes.criticalSupplies());
}

/** GET /api/v1/reports/queries: el texto MQL de las 13 consultas, para mostrarlo en la pantalla de reportes. */
async function queries(req, res) {
  return ok(res, consultas.map(({ n, tipo, rf, titulo, texto }) => ({ n, tipo, rf, titulo, texto })));
}

module.exports = { topProducts, criticalSupplies, queries };
