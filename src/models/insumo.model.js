'use strict';

const { col, nextId, LOOSE } = require('../config/mongo');

function toInsumo(d) {
  const reservado = d.stock_reservado || 0;
  return {
    id_insumo: d._id,
    nombre: d.nombre,
    unidad_medida: d.unidad_medida,
    stock_actual: d.stock_actual,
    stock_reservado: reservado,
    stock_minimo: d.stock_minimo,
    contiene_gluten: Boolean(d.contiene_gluten),
    contiene_lactosa: Boolean(d.contiene_lactosa),
    es_origen_animal: Boolean(d.es_origen_animal),
    critico: d.stock_actual <= d.stock_minimo,
  };
}

/** Lista de insumos. Con critical = true solo los que llegaron a su stock mínimo (RF13). */
async function findAll({ critical = false } = {}) {
  const filter = critical ? { $expr: { $lte: ['$stock_actual', '$stock_minimo'] } } : {};
  const docs = await col('insumos').find(filter).sort({ nombre: 1 }).collation(LOOSE).toArray();
  return docs.map(toInsumo);
}

async function findById(id) {
  const d = await col('insumos').findOne({ _id: id });
  return d ? toInsumo(d) : null;
}

/** true si ya existe otro insumo con ese nombre (compara sin mayúsculas ni tildes). */
async function nameExists(nombre, exceptId = 0) {
  const d = await col('insumos').findOne({ nombre, _id: { $ne: exceptId } }, { collation: LOOSE, projection: { _id: 1 } });
  return Boolean(d);
}

/** Consulta 08 (INSERT): registrar un insumo. */
async function create(data) {
  const _id = await nextId('insumos');
  await col('insumos').insertOne({
    _id,
    nombre: data.nombre,
    unidad_medida: data.unidad_medida,
    stock_actual: data.stock_actual,
    stock_reservado: 0,
    stock_minimo: data.stock_minimo,
    contiene_gluten: data.contiene_gluten,
    contiene_lactosa: data.contiene_lactosa,
    es_origen_animal: data.es_origen_animal,
  });
  return findById(_id);
}

/** Consulta 06 (UPDATE): reabastecer sumando al stock actual. Devuelve null si no existe. */
async function restock(id, cantidad) {
  const res = await col('insumos').findOneAndUpdate({ _id: id }, { $inc: { stock_actual: cantidad } }, { returnDocument: 'after' });
  return res ? toInsumo(res) : null;
}

/**
 * Corrección del stock hacia abajo (por ejemplo, si se reabasteció de más). Solo descuenta del stock libre:
 * lo que está reservado por un pago en curso no se puede quitar. Devuelve null si no existe y false si no alcanza.
 */
async function withdraw(id, cantidad) {
  const res = await col('insumos').findOneAndUpdate(
    { _id: id, $expr: { $gte: [{ $subtract: ['$stock_actual', { $ifNull: ['$stock_reservado', 0] }] }, cantidad] } },
    { $inc: { stock_actual: -cantidad } },
    { returnDocument: 'after' }
  );
  if (res) return toInsumo(res);
  return (await col('insumos').findOne({ _id: id }, { projection: { _id: 1 } })) ? false : null;
}

/**
 * RF11: edita un insumo. Si cambia el nombre o la unidad se actualizan las copias que llevan las recetas,
 * y si cambia una marca de alérgeno se recalcula apto_para de los productos que lo usan (ver informe 7.2).
 */
async function update(id, data) {
  const res = await col('insumos').findOneAndUpdate(
    { _id: id },
    { $set: {
      nombre: data.nombre,
      unidad_medida: data.unidad_medida,
      stock_actual: data.stock_actual,
      stock_minimo: data.stock_minimo,
      contiene_gluten: data.contiene_gluten,
      contiene_lactosa: data.contiene_lactosa,
      es_origen_animal: data.es_origen_animal,
    } },
    { returnDocument: 'after' }
  );
  if (!res) return null;
  await col('productos').updateMany(
    { 'receta.insumo_id': id },
    { $set: { 'receta.$[r].nombre': data.nombre, 'receta.$[r].unidad_medida': data.unidad_medida } },
    { arrayFilters: [{ 'r.insumo_id': id }] }
  );
  const Producto = require('./producto.model');
  await Producto.recomputeAptoByInsumo(id);
  return toInsumo(res);
}

/** true si el insumo forma parte de la receta de algún producto. */
async function inUse(id) {
  const d = await col('productos').findOne({ 'receta.insumo_id': id }, { projection: { _id: 1 } });
  return Boolean(d);
}

/** Eliminar: la aplicación lo bloquea (409) si el insumo está en alguna receta (en Mongo no hay FK que lo haga). */
async function remove(id) {
  const res = await col('insumos').deleteOne({ _id: id });
  return res.deletedCount > 0;
}

module.exports = { findAll, findById, create, restock, withdraw, update, remove, nameExists, inUse, toInsumo };
