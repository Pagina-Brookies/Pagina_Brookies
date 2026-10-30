'use strict';

const { col, nextId, LOOSE } = require('../config/mongo');
const { HttpError } = require('../utils/errors');

const SUITABLE_FLAG = {
  sin_gluten: 'contiene_gluten',
  sin_lactosa: 'contiene_lactosa',
  vegano: 'es_origen_animal',
};

/** Escapa el texto del usuario para usarlo literal dentro de una expresión regular. */
const escapeRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex que ignora mayúsculas y tildes: "cafe" encuentra "Café". */
function looseRegex(text) {
  const map = { a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]' };
  const base = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '');
  return new RegExp(escapeRegex(base).replace(/[aeioun]/gi, (c) => map[c.toLowerCase()]), 'i');
}

/**
 * Etapas del pipeline que calculan la disponibilidad efectiva (consulta 03 / Q1).
 * Un producto está disponible si el administrador lo dejó en el menú, tiene receta y para cada insumo de la
 * receta queda stock libre (stock_actual - stock_reservado) suficiente. La disponibilidad no se guarda porque
 * cambia con cada venta: se calcula al consultar. Un producto sin receta nunca queda disponible.
 */
const STOCK_STAGES = [
  { $lookup: { from: 'insumos', localField: 'receta.insumo_id', foreignField: '_id', as: '_ins' } },
  { $addFields: {
    _faltantes: { $size: { $filter: {
      input: '$receta',
      as: 'r',
      cond: { $let: {
        vars: { i: { $arrayElemAt: [{ $filter: { input: '$_ins', as: 'x', cond: { $eq: ['$$x._id', '$$r.insumo_id'] } } }, 0] } },
        in: { $lt: [
          { $subtract: [{ $ifNull: ['$$i.stock_actual', 0] }, { $ifNull: ['$$i.stock_reservado', 0] }] },
          '$$r.cantidad_requerida',
        ] },
      } },
    } } },
  } },
  { $addFields: {
    disponible_efectivo: { $and: ['$disponible', { $gt: [{ $size: '$receta' }, 0] }, { $eq: ['$_faltantes', 0] }] },
  } },
];

function toProduct(d, withRecipe = false) {
  const out = {
    id_producto: d._id,
    nombre: d.nombre,
    descripcion: d.descripcion === undefined ? null : d.descripcion,
    precio: d.precio,
    categoria: d.categoria,
    tipo_preparacion: d.tipo_preparacion,
    disponible: Boolean(d.disponible),
    disponible_efectivo: Boolean(d.disponible_efectivo),
    apto_para: d.apto_para || [],
  };
  if (withRecipe) {
    out.receta = (d.receta || [])
      .map((r) => ({ id_insumo: r.insumo_id, nombre: r.nombre, unidad_medida: r.unidad_medida, cantidad_requerida: r.cantidad_requerida }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  return out;
}

/** Unidades vendidas por producto (suma de items en pedidos): sirve para el orden "más vendido". */
async function soldMap() {
  const rows = await col('pedidos').aggregate([
    { $unwind: '$items' },
    { $group: { _id: '$items.producto_id', unidades: { $sum: '$items.cantidad' } } },
  ]).toArray();
  return new Map(rows.map((r) => [r._id, r.unidades]));
}

/** Consulta de productos con filtros (RF04, consulta 03). El texto del usuario nunca se concatena: va como valor. */
async function findAll({ category, onlyAvailable, name, suitableFor, preparation, sort }) {
  const match = {};
  if (category && category !== 'todas') match.categoria = category;
  if (name) match.nombre = looseRegex(name);
  if (suitableFor) match.apto_para = suitableFor;
  if (preparation) match.tipo_preparacion = preparation;

  const pipeline = [{ $match: match }, ...STOCK_STAGES];
  if (onlyAvailable) pipeline.push({ $match: { disponible_efectivo: true } });
  pipeline.push({ $project: { _ins: 0, _faltantes: 0 } });
  if (sort === 'precio') pipeline.push({ $sort: { precio: 1, nombre: 1 } });
  else pipeline.push({ $sort: { nombre: 1 } });

  let docs = await col('productos').aggregate(pipeline, { collation: LOOSE }).toArray();
  if (sort === 'mas_vendido') {
    const sold = await soldMap();
    docs = docs.sort((a, b) => (sold.get(b._id) || 0) - (sold.get(a._id) || 0) || a.nombre.localeCompare(b.nombre, 'es'));
  }
  return docs.map((d) => toProduct(d));
}

/** Varios productos por id, con disponibilidad efectiva y receta (los usa el pedido). */
async function findManyWithStock(ids, session) {
  const docs = await col('productos').aggregate([{ $match: { _id: { $in: ids } } }, ...STOCK_STAGES, { $project: { _ins: 0 } }], { session }).toArray();
  return docs;
}

async function findById(id) {
  const docs = await col('productos').aggregate([{ $match: { _id: id } }, ...STOCK_STAGES, { $project: { _ins: 0, _faltantes: 0 } }]).toArray();
  return docs.length ? toProduct(docs[0], true) : null;
}

async function nameExists(nombre, exceptId = 0) {
  const d = await col('productos').findOne({ nombre, _id: { $ne: exceptId } }, { collation: LOOSE, projection: { _id: 1 } });
  return Boolean(d);
}

/** apto_para sale de los insumos de la receta: apto para X si tiene receta y ningún insumo tiene la marca. */
async function computeApto(receta) {
  if (!receta || receta.length === 0) return [];
  const ins = await col('insumos').find({ _id: { $in: receta.map((r) => r.insumo_id) } }).toArray();
  const apto = [];
  for (const [clave, flag] of Object.entries(SUITABLE_FLAG)) {
    if (!ins.some((i) => i[flag])) apto.push(clave);
  }
  return apto;
}

async function recomputeApto(idProducto) {
  const p = await col('productos').findOne({ _id: idProducto }, { projection: { receta: 1 } });
  if (!p) return;
  await col('productos').updateOne({ _id: idProducto }, { $set: { apto_para: await computeApto(p.receta) } });
}

async function recomputeAptoByInsumo(idInsumo) {
  const prods = await col('productos').find({ 'receta.insumo_id': idInsumo }, { projection: { _id: 1 } }).toArray();
  for (const p of prods) await recomputeApto(p._id);
}

/** Consulta 09 (INSERT): agregar un producto al menú. Nace sin receta. */
async function create(data) {
  const _id = await nextId('productos');
  await col('productos').insertOne({
    _id,
    nombre: data.nombre,
    descripcion: data.descripcion,
    precio: data.precio,
    categoria: data.categoria,
    tipo_preparacion: data.tipo_preparacion,
    disponible: data.disponible,
    apto_para: [],
    receta: [],
  });
  return findById(_id);
}

async function update(id, data) {
  const res = await col('productos').updateOne({ _id: id }, { $set: {
    nombre: data.nombre,
    descripcion: data.descripcion,
    precio: data.precio,
    categoria: data.categoria,
    tipo_preparacion: data.tipo_preparacion,
    disponible: data.disponible,
  } });
  if (res.matchedCount === 0) return null;
  return findById(id);
}

/** true si el producto ya tiene ventas (aparece en algún pedido). */
async function hasSales(id) {
  const d = await col('pedidos').findOne({ 'items.producto_id': id }, { projection: { _id: 1 } });
  return Boolean(d);
}

async function remove(id) {
  const res = await col('productos').deleteOne({ _id: id });
  return res.deletedCount > 0;
}

/** Consulta 10 (INSERT ... SELECT): agrega o actualiza un insumo en la receta (copia nombre y unidad del insumo). */
async function addRecipeItem(idProducto, idInsumo, cantidad) {
  const ins = await col('insumos').findOne({ _id: idInsumo });
  if (!ins) throw new HttpError(400, { field: 'id_insumo', message: 'el insumo indicado no existe' });
  const upd = await col('productos').updateOne(
    { _id: idProducto, 'receta.insumo_id': idInsumo },
    { $set: { 'receta.$.cantidad_requerida': cantidad } }
  );
  if (upd.matchedCount === 0) {
    await col('productos').updateOne({ _id: idProducto }, { $push: { receta: {
      insumo_id: idInsumo, nombre: ins.nombre, unidad_medida: ins.unidad_medida, cantidad_requerida: cantidad,
    } } });
  }
  await recomputeApto(idProducto);
  return findById(idProducto);
}

/** Consulta 11 (DELETE): quita un insumo de la receta. false si no estaba. */
async function removeRecipeItem(idProducto, idInsumo) {
  const res = await col('productos').updateOne({ _id: idProducto }, { $pull: { receta: { insumo_id: idInsumo } } });
  if (res.modifiedCount === 0) return false;
  await recomputeApto(idProducto);
  return true;
}

module.exports = {
  findAll, findById, findManyWithStock, create, update, remove, hasSales, nameExists,
  addRecipeItem, removeRecipeItem, recomputeApto, recomputeAptoByInsumo, computeApto, STOCK_STAGES,
};

/**
 * Consulta 07 / RF10: descuenta del stock los insumos de la receta por la cantidad vendida (venta manual del admin).
 * Cada insumo se descuenta solo si le alcanza; si alguno no alcanza, la transacción se revierte completa.
 * Devuelve la cantidad de insumos descontados (0 si no hay receta).
 */
async function sellByRecipe(idProducto, cantidad) {
  const { withTx } = require('../config/mongo');
  return withTx(async (session) => {
    const p = await col('productos').findOne({ _id: idProducto }, { projection: { receta: 1 }, session });
    if (!p || p.receta.length === 0) return 0;
    const hechos = [];
    try {
      for (const r of p.receta) {
        const need = r.cantidad_requerida * cantidad;
        const res = await col('insumos').updateOne(
          { _id: r.insumo_id, $expr: { $gte: [{ $subtract: ['$stock_actual', { $ifNull: ['$stock_reservado', 0] }] }, need] } },
          { $inc: { stock_actual: -need } },
          { session }
        );
        if (res.modifiedCount !== 1) throw new HttpError(409, { message: `stock insuficiente de ${r.nombre}: la venta dejaría el inventario bajo cero` });
        hechos.push([r.insumo_id, need]);
      }
    } catch (e) {
      if (!session) for (const [id, need] of hechos) await col('insumos').updateOne({ _id: id }, { $inc: { stock_actual: need } });
      throw e;
    }
    return p.receta.length;
  });
}
module.exports.sellByRecipe = sellByRecipe;
