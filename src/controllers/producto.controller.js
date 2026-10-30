'use strict';

const Producto = require('../models/producto.model');
const {
  parseId, parseProductQuery, validateProductoCreate, validateProductoUpdate, validateRecetaItem, validateSell,
} = require('../utils/validators');
const { ok, fail } = require('../utils/respond');

const badId = (res, field = 'id') => fail(res, 400, { field, message: 'debe ser un entero positivo' });

/** GET /api/v1/products (RF04) */
async function list(req, res) {
  const { errors, filters } = parseProductQuery(req.query);
  if (errors.length) return fail(res, 400, errors);
  return ok(res, await Producto.findAll(filters));
}

/** GET /api/v1/products/:id */
async function getById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const p = await Producto.findById(id);
  return p ? ok(res, p) : fail(res, 404, 'producto no existe');
}

/** POST /api/v1/products (RF15) */
async function create(req, res) {
  const { errors, data } = validateProductoCreate(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (await Producto.nameExists(data.nombre)) return fail(res, 409, `ya existe un producto llamado "${data.nombre}"`);
  return ok(res, await Producto.create(data), 201);
}

/** PUT /api/v1/products/:id (RF15) */
async function update(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateProductoUpdate(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (await Producto.nameExists(data.nombre, id)) return fail(res, 409, `ya existe otro producto llamado "${data.nombre}"`);
  const p = await Producto.update(id, data);
  return p ? ok(res, p) : fail(res, 404, 'producto no existe');
}

/** DELETE /api/v1/products/:id (RF15). Un producto con ventas no se elimina: en Mongo no hay FK, la regla la aplica el servicio. */
async function remove(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  if (await Producto.hasSales(id)) {
    return fail(res, 409, 'no se puede eliminar: el producto ya tiene ventas registradas. Márquelo como no disponible (disponible: false) en su lugar.');
  }
  return (await Producto.remove(id)) ? ok(res, { id_producto: id, eliminado: true }) : fail(res, 404, 'producto no existe');
}

/** POST /api/v1/products/:id/recipe (RF12) */
async function addRecipeItem(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateRecetaItem(req.body);
  if (errors.length) return fail(res, 400, errors);
  if (!(await Producto.findById(id))) return fail(res, 404, 'producto no existe');
  return ok(res, await Producto.addRecipeItem(id, data.id_insumo, data.cantidad_requerida), 201);
}

/** DELETE /api/v1/products/:id/recipe/:idInsumo (RF12) */
async function removeRecipeItem(req, res) {
  const id = parseId(req.params.id);
  const idInsumo = parseId(req.params.idInsumo);
  if (id === null || idInsumo === null) return badId(res, id === null ? 'id' : 'idInsumo');
  if (!(await Producto.removeRecipeItem(id, idInsumo))) return fail(res, 404, 'ese insumo no está en la receta de este producto');
  return ok(res, { id_producto: id, id_insumo: idInsumo, eliminado: true });
}

/** POST /api/v1/products/:id/sell (RF10): descuento manual de inventario por receta. */
async function sell(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return badId(res);
  const { errors, data } = validateSell(req.body);
  if (errors.length) return fail(res, 400, errors);
  const p = await Producto.findById(id);
  if (!p) return fail(res, 404, 'producto no existe');
  if (!p.disponible) return fail(res, 422, 'el producto está marcado como no disponible en el menú; no se puede vender');
  if (!p.receta.length) return fail(res, 422, 'el producto no tiene una receta definida; no se puede descontar inventario');
  await Producto.sellByRecipe(id, data.cantidad);
  const updated = await Producto.findById(id);
  return ok(res, { producto: updated.nombre, cantidad_vendida: data.cantidad, receta_actualizada: updated.receta });
}

module.exports = { list, getById, create, update, remove, addRecipeItem, removeRecipeItem, sell };
