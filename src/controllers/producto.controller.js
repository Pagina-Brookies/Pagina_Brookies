'use strict';

const Producto = require('../models/producto.model');
const { parseProductQuery, parseId } = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

/** GET /api/v1/products - consulta de productos con filtros. */
async function list(req, res, next) {
  try {
    const { errors, filters } = parseProductQuery(req.query);
    if (errors.length > 0) return fail(res, 400, errors);
    const products = await Producto.findAll(filters);
    return ok(res, products);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/v1/products/:id - un producto con su receta. */
async function getById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });
    const product = await Producto.findById(id);
    if (!product) return fail(res, 404, 'producto no existe');
    return ok(res, product);
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, getById };
