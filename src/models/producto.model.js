'use strict';

const db = require('../config/db');
const { escapeLike } = require('../utils/validators');

// Un producto está disponible si el administrador lo dejó en el menú (disponible = TRUE)
// y además hay stock suficiente de cada insumo de su receta.
const STOCK_OK = `NOT EXISTS (
    SELECT 1
    FROM receta r
    JOIN insumo i ON i.id_insumo = r.id_insumo
    WHERE r.id_producto = p.id_producto
      AND i.stock_actual < r.cantidad_requerida
)`;
const EFFECTIVE_AVAILABLE = `(p.disponible = TRUE AND ${STOCK_OK})`;

// Columna de insumo que revisa cada filtro "apto para". Sale de esta lista fija,
// nunca del texto que envía el usuario, por eso es seguro escribirla en la consulta.
const SUITABLE_FLAG = {
  sin_gluten: 'contiene_gluten',
  sin_lactosa: 'contiene_lactosa',
  vegano: 'es_origen_animal',
};

const SELECT_COLUMNS = `
    p.id_producto, p.nombre, p.descripcion, p.precio, p.categoria, p.tipo_preparacion,
    p.disponible, ${EFFECTIVE_AVAILABLE} AS disponible_efectivo`;

function toProduct(row) {
  return {
    ...row,
    disponible: Boolean(row.disponible),
    disponible_efectivo: Boolean(row.disponible_efectivo),
  };
}

/**
 * Consulta de productos (RF04). Los valores del usuario viajan siempre como parámetros (?).
 */
async function findAll({ category, onlyAvailable, name, suitableFor, preparation, sort }) {
  const where = [];
  const params = [];

  if (category && category !== 'todas') {
    where.push('p.categoria = ?');
    params.push(category);
  }
  if (onlyAvailable) {
    where.push(EFFECTIVE_AVAILABLE);
  }
  if (name) {
    where.push("p.nombre LIKE ? ESCAPE '\\\\'");
    params.push(`%${escapeLike(name)}%`);
  }
  if (suitableFor) {
    const flag = SUITABLE_FLAG[suitableFor];
    where.push(`NOT EXISTS (
        SELECT 1
        FROM receta r2
        JOIN insumo i2 ON i2.id_insumo = r2.id_insumo
        WHERE r2.id_producto = p.id_producto AND i2.${flag} = TRUE
    )`);
  }
  if (preparation) {
    where.push('p.tipo_preparacion = ?');
    params.push(preparation);
  }

  let orderBy = 'p.nombre ASC';
  if (sort === 'precio') {
    orderBy = 'p.precio ASC, p.nombre ASC';
  } else if (sort === 'mas_vendido') {
    orderBy = `(SELECT COALESCE(SUM(d.cantidad), 0) FROM detalle_pedido d
                WHERE d.id_producto = p.id_producto) DESC, p.nombre ASC`;
  }

  const sql = `SELECT ${SELECT_COLUMNS}
               FROM producto p
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY ${orderBy}`;
  const rows = await db.execute(sql, params);
  return rows.map(toProduct);
}

/** Un producto con los insumos de su receta, o null si no existe. */
async function findById(id) {
  const rows = await db.execute(`SELECT ${SELECT_COLUMNS} FROM producto p WHERE p.id_producto = ?`, [id]);
  if (rows.length === 0) return null;

  const receta = await db.execute(
    `SELECT i.id_insumo, i.nombre, i.unidad_medida, r.cantidad_requerida
     FROM receta r
     JOIN insumo i ON i.id_insumo = r.id_insumo
     WHERE r.id_producto = ?
     ORDER BY i.nombre`,
    [id]
  );
  return { ...toProduct(rows[0]), receta };
}

module.exports = { findAll, findById };
