'use strict';

const Producto = require('../models/producto.model');
const {
  parseId, parseProductQuery, validateProductoCreate, validateRecetaItem, validateSell,
} = require('../utils/validators');
const { ok, fail } = require('../utils/respond');
const { mapSqlError } = require('../utils/sqlErrors');

/** GET /api/v1/products — consulta de productos con filtros (RF04). */
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

/** GET /api/v1/products/:id — un producto con su receta. */
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

/** POST /api/v1/products — RF15: agregar producto al menú. */
async function create(req, res, next) {
  try {
    const { errors, data } = validateProductoCreate(req.body);
    if (errors.length > 0) return fail(res, 400, errors);
    const product = await Producto.create(data);
    return ok(res, product, 201);
  } catch (err) {
    const mapped = mapSqlError(err, { checkMessages: { ck_producto_precio: 'el precio debe ser mayor a 0' } });
    if (mapped) return fail(res, mapped.status, mapped.message);
    return next(err);
  }
}

/** POST /api/v1/products/:id/recipe — RF12: agregar/actualizar un insumo de la receta. */
async function addRecipeItem(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });

    const { errors, data } = validateRecetaItem(req.body);
    if (errors.length > 0) return fail(res, 400, errors);

    const existing = await Producto.findById(id);
    if (!existing) return fail(res, 404, 'producto no existe');

    const product = await Producto.addRecipeItem(id, data.id_insumo, data.cantidad_requerida);
    return ok(res, product, 201);
  } catch (err) {
    const mapped = mapSqlError(err, {
      fkMessage: 'el insumo indicado no existe',
      checkMessages: { ck_receta_cantidad: 'la cantidad requerida debe ser mayor a 0' },
    });
    if (mapped) return fail(res, mapped.status, mapped.message);
    return next(err);
  }
}

/** DELETE /api/v1/products/:id/recipe/:idInsumo — RF12: quitar un insumo de la receta. */
async function removeRecipeItem(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const idInsumo = parseId(req.params.idInsumo);
    if (id === null || idInsumo === null) {
      return fail(res, 400, { field: id === null ? 'id' : 'idInsumo', message: 'debe ser un entero positivo' });
    }
    const removed = await Producto.removeRecipeItem(id, idInsumo);
    if (!removed) return fail(res, 404, 'ese insumo no está en la receta de este producto');
    return ok(res, { id_producto: id, id_insumo: idInsumo, eliminado: true });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/v1/products/:id/sell — RF10: descontar insumos según receta al vender. */
async function sell(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) return fail(res, 400, { field: 'id', message: 'debe ser un entero positivo' });

    const { errors, data } = validateSell(req.body);
    if (errors.length > 0) return fail(res, 400, errors);

    const product = await Producto.findById(id);
    if (!product) return fail(res, 404, 'producto no existe');
    if (!product.receta || product.receta.length === 0) {
      return fail(res, 422, 'el producto no tiene una receta definida; no se puede descontar inventario');
    }

    const affected = await Producto.sellByRecipe(id, data.cantidad);
    if (affected === 0) return fail(res, 422, 'no se pudo descontar: revise la receta del producto');

    const updated = await Producto.findById(id);
    return ok(res, { producto: updated.nombre, cantidad_vendida: data.cantidad, receta_actualizada: updated.receta });
  } catch (err) {
    const mapped = mapSqlError(err, { checkMessages: { ck_insumo_stock_actual: 'stock insuficiente: la venta dejaría algún insumo bajo cero' } });
    if (mapped) return fail(res, mapped.status, mapped.message);
    return next(err);
  }
}

module.exports = { list, getById, create, addRecipeItem, removeRecipeItem, sell };
