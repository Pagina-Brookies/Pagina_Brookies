'use strict';

/**
 * Las 13 consultas de la Entrega 1 (antes SQL) escritas en MongoDB Query Language.
 * Cada una conserva su número y el requisito que cubre. Los modelos del sistema usan estas mismas
 * definiciones, y scripts/queries.js las ejecuta en orden para mostrarlas funcionando.
 * Las consultas con JOIN pasan a $lookup; GROUP BY a $group; las FK con CASCADE a documentos embebidos.
 */

const { col, LOOSE } = require('../config/mongo');

// ---- Pipelines reutilizables (los usa también el sistema) ----------------------------------------

/** Consulta 04: unidades vendidas por producto. JOIN pedidos(items) con productos y GROUP BY producto. */
const PIPELINE_MAS_VENDIDOS = [
  { $unwind: '$items' },
  { $group: { _id: '$items.producto_id', unidades_vendidas: { $sum: '$items.cantidad' } } },
  { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'p' } },
  { $unwind: '$p' },
  { $project: { _id: 0, id_producto: '$_id', nombre: '$p.nombre', unidades_vendidas: 1 } },
  { $sort: { unidades_vendidas: -1, nombre: 1 } },
];

/** Consulta 05: insumos con stock crítico y los productos que los usan (JOIN insumo-receta-producto). */
const PIPELINE_CRITICOS = [
  { $match: { $expr: { $lte: ['$stock_actual', '$stock_minimo'] } } },
  { $lookup: { from: 'productos', localField: '_id', foreignField: 'receta.insumo_id', as: 'p' } },
  { $unwind: '$p' },
  { $project: { _id: 0, insumo: '$nombre', stock_actual: 1, stock_minimo: 1, producto: '$p.nombre' } },
  { $sort: { insumo: 1, producto: 1 } },
];

// ---- Las 13 consultas ----------------------------------------------------------------------------

const consultas = [
  {
    n: 0, tipo: 'preparación', rf: '-', titulo: 'Crear la colección de respaldo de insumos',
    texto: `db.insumos.aggregate([
  { $project: { _id: 1, nombre: 1, stock_actual: 1 } },
  { $out: "respaldo_insumo" }
])`,
    run: () => col('insumos').aggregate([{ $project: { _id: 1, nombre: 1, stock_actual: 1 } }, { $out: 'respaldo_insumo' }]).toArray(),
  },
  {
    n: 1, tipo: 'ALTER (índice)', rf: 'RNF04', titulo: 'Índice sobre productos.categoria',
    texto: `db.productos.createIndex({ categoria: 1 }, { name: "idx_producto_categoria" })`,
    run: () => col('productos').createIndex({ categoria: 1 }, { name: 'idx_producto_categoria' }),
  },
  {
    n: 2, tipo: 'ALTER (agregar campo)', rf: '-', titulo: 'Agregar fecha_respaldo al respaldo',
    texto: `db.respaldo_insumo.updateMany({}, { $set: { fecha_respaldo: new Date() } })`,
    run: () => col('respaldo_insumo').updateMany({}, { $set: { fecha_respaldo: new Date() } }),
  },
  {
    n: 3, tipo: 'SELECT (find)', rf: 'RF04', titulo: 'Productos filtrados por categoría, disponibilidad y preparación',
    texto: `db.productos.find(
  { categoria: "Café", disponible: true, tipo_preparacion: "caliente" },
  { nombre: 1, descripcion: 1, precio: 1, categoria: 1, tipo_preparacion: 1 }
).sort({ precio: 1 })`,
    run: (p = {}) => col('productos').find(
      { categoria: p.categoria || 'Café', disponible: true, tipo_preparacion: p.tipo_preparacion || 'caliente' },
      { projection: { nombre: 1, descripcion: 1, precio: 1, categoria: 1, tipo_preparacion: 1 } }
    ).sort({ precio: 1 }).toArray(),
  },
  {
    n: 4, tipo: 'SELECT con JOIN y GROUP BY', rf: 'RF16', titulo: 'Productos más vendidos',
    texto: `db.pedidos.aggregate([
  { $unwind: "$items" },
  { $group: { _id: "$items.producto_id", unidades_vendidas: { $sum: "$items.cantidad" } } },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p" } },
  { $unwind: "$p" },
  { $project: { _id: 0, id_producto: "$_id", nombre: "$p.nombre", unidades_vendidas: 1 } },
  { $sort: { unidades_vendidas: -1, nombre: 1 } }
])`,
    run: () => col('pedidos').aggregate(PIPELINE_MAS_VENDIDOS).toArray(),
  },
  {
    n: 5, tipo: 'SELECT con JOIN de 3 tablas', rf: 'RF13', titulo: 'Insumos críticos y los productos que los usan',
    texto: `db.insumos.aggregate([
  { $match: { $expr: { $lte: ["$stock_actual", "$stock_minimo"] } } },
  { $lookup: { from: "productos", localField: "_id", foreignField: "receta.insumo_id", as: "p" } },
  { $unwind: "$p" },
  { $project: { _id: 0, insumo: "$nombre", stock_actual: 1, stock_minimo: 1, producto: "$p.nombre" } },
  { $sort: { insumo: 1, producto: 1 } }
])`,
    run: () => col('insumos').aggregate(PIPELINE_CRITICOS).toArray(),
  },
  {
    n: 6, tipo: 'UPDATE', rf: 'RF14', titulo: 'Reabastecer un insumo',
    texto: `db.insumos.updateOne({ _id: 1 }, { $inc: { stock_actual: 500 } })`,
    run: (p = {}) => col('insumos').updateOne({ _id: p.id_insumo || 1 }, { $inc: { stock_actual: p.cantidad || 500 } }),
  },
  {
    n: 7, tipo: 'UPDATE con JOIN', rf: 'RF10', titulo: 'Descontar insumos según la receta',
    texto: `const p = db.productos.findOne({ _id: 1 }, { receta: 1 });
db.insumos.bulkWrite(p.receta.map(r => ({
  updateOne: {
    filter: { _id: r.insumo_id, stock_actual: { $gte: r.cantidad_requerida * 2 } },
    update: { $inc: { stock_actual: -(r.cantidad_requerida * 2) } }
  }
})))`,
    run: async (p = {}) => {
      const prod = await col('productos').findOne({ _id: p.id_producto || 1 }, { projection: { receta: 1 } });
      const cant = p.cantidad || 2;
      return col('insumos').bulkWrite(prod.receta.map((r) => ({
        updateOne: {
          filter: { _id: r.insumo_id, stock_actual: { $gte: r.cantidad_requerida * cant } },
          update: { $inc: { stock_actual: -(r.cantidad_requerida * cant) } },
        },
      })));
    },
  },
  {
    n: 8, tipo: 'INSERT', rf: 'RF11', titulo: 'Registrar un insumo',
    texto: `db.insumos.insertOne({
  _id: 100, nombre: "Canela molida", unidad_medida: "g", stock_actual: 300, stock_reservado: 0,
  stock_minimo: 50, contiene_gluten: false, contiene_lactosa: false, es_origen_animal: false
})`,
    run: () => col('insumos').insertOne({
      _id: 100, nombre: 'Canela molida', unidad_medida: 'g', stock_actual: 300, stock_reservado: 0,
      stock_minimo: 50, contiene_gluten: false, contiene_lactosa: false, es_origen_animal: false,
    }),
  },
  {
    n: 9, tipo: 'INSERT', rf: 'RF15', titulo: 'Agregar un producto al menú',
    texto: `db.productos.insertOne({
  _id: 100, nombre: "Chai latte", descripcion: "Té especiado con leche", precio: 3200,
  categoria: "Café", tipo_preparacion: "caliente", disponible: true, apto_para: [], receta: []
})`,
    run: () => col('productos').insertOne({
      _id: 100, nombre: 'Chai latte', descripcion: 'Té especiado con leche', precio: 3200,
      categoria: 'Café', tipo_preparacion: 'caliente', disponible: true, apto_para: [], receta: [],
    }),
  },
  {
    n: 10, tipo: 'INSERT ... SELECT', rf: 'RF12', titulo: 'Definir la receta de un producto (por nombre)',
    texto: `const i = db.insumos.findOne({ nombre: "Canela molida" });
db.productos.updateOne({ nombre: "Chai latte" }, {
  $push: { receta: { insumo_id: i._id, nombre: i.nombre, unidad_medida: i.unidad_medida, cantidad_requerida: 5 } }
})`,
    run: async () => {
      const i = await col('insumos').findOne({ nombre: 'Canela molida' });
      return col('productos').updateOne({ nombre: 'Chai latte' }, {
        $push: { receta: { insumo_id: i._id, nombre: i.nombre, unidad_medida: i.unidad_medida, cantidad_requerida: 5 } },
      });
    },
  },
  {
    n: 11, tipo: 'DELETE', rf: 'RF12', titulo: 'Quitar un insumo de la receta',
    texto: `db.productos.updateOne({ nombre: "Chai latte" }, { $pull: { receta: { nombre: "Canela molida" } } })`,
    run: () => col('productos').updateOne({ nombre: 'Chai latte' }, { $pull: { receta: { nombre: 'Canela molida' } } }),
  },
  {
    n: 12, tipo: 'DELETE (antes con CASCADE)', rf: '-', titulo: 'Eliminar un pedido de prueba',
    texto: `db.pedidos.deleteOne({ _id: 9999 })
// items y pago van dentro del documento: se eliminan junto con el pedido, sin necesitar CASCADE`,
    run: async () => {
      await col('pedidos').insertOne({
        _id: 9999, cliente: { _id: 1, nombre: 'Prueba' }, fecha: new Date(), estado: 'recibido',
        items: [{ producto_id: 1, nombre: 'Prueba', cantidad: 1, precio_unitario: 1000 }], total: 1000,
        pago: { monto: 1000, metodo_pago: 'tarjeta', token_transaccion: 'tok_prueba', estado_pago: 'aprobado', fecha_pago: new Date() },
      });
      return col('pedidos').deleteOne({ _id: 9999 });
    },
  },
  {
    n: 13, tipo: 'DROP', rf: '-', titulo: 'Eliminar la colección de respaldo',
    texto: `db.respaldo_insumo.drop()`,
    run: () => col('respaldo_insumo').drop(),
  },
];

module.exports = { consultas, PIPELINE_MAS_VENDIDOS, PIPELINE_CRITICOS, LOOSE };
