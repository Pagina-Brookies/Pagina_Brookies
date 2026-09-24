'use strict';

const db = require('../config/db');

/** Consulta 04 — productos más vendidos (JOIN con detalle_pedido). */
async function topProducts() {
  return db.execute(
    `SELECT p.id_producto, p.nombre, SUM(d.cantidad) AS unidades_vendidas
     FROM producto p
     JOIN detalle_pedido d ON d.id_producto = p.id_producto
     GROUP BY p.id_producto, p.nombre
     ORDER BY unidades_vendidas DESC, p.nombre ASC`
  );
}

/** Consulta 05 — insumos en stock crítico y los productos que los usan (JOIN de 3 tablas). */
async function criticalSupplies() {
  return db.execute(
    `SELECT DISTINCT i.nombre AS insumo, i.stock_actual, i.stock_minimo, p.nombre AS producto
     FROM insumo i
     JOIN receta r ON r.id_insumo = i.id_insumo
     JOIN producto p ON p.id_producto = r.id_producto
     WHERE i.stock_actual <= i.stock_minimo
     ORDER BY i.nombre, p.nombre`
  );
}

module.exports = { topProducts, criticalSupplies };
