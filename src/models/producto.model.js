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

// Un producto es apto para X si ningún insumo de su receta tiene la marca correspondiente.
const aptoPara = (flag) => `NOT EXISTS (
    SELECT 1 FROM receta ra JOIN insumo ia ON ia.id_insumo = ra.id_insumo
    WHERE ra.id_producto = p.id_producto AND ia.${flag} = TRUE)`;

const SELECT_COLUMNS = `
    p.id_producto, p.nombre, p.descripcion, p.precio, p.categoria, p.tipo_preparacion,
    p.disponible, ${EFFECTIVE_AVAILABLE} AS disponible_efectivo,
    ${aptoPara('contiene_gluten')} AS apto_sin_gluten,
    ${aptoPara('contiene_lactosa')} AS apto_sin_lactosa,
    ${aptoPara('es_origen_animal')} AS apto_vegano`;

function toProduct(row) {
  const { apto_sin_gluten, apto_sin_lactosa, apto_vegano, ...rest } = row;
  const apto_para = [];
  if (apto_sin_gluten) apto_para.push('sin_gluten');
  if (apto_sin_lactosa) apto_para.push('sin_lactosa');
  if (apto_vegano) apto_para.push('vegano');
  return {
    ...rest,
    disponible: Boolean(row.disponible),
    disponible_efectivo: Boolean(row.disponible_efectivo),
    apto_para,
  };
}

/** true si ya existe otro producto con ese nombre (la comparación ignora mayúsculas y tildes). */
async function nameExists(nombre, exceptId = 0) {
  const rows = await db.execute('SELECT 1 FROM producto WHERE nombre = ? AND id_producto <> ? LIMIT 1', [nombre, exceptId]);
  return rows.length > 0;
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

/** RF15 — agregar un producto al menú. */
async function create(data) {
  const result = await db.execute(
    `INSERT INTO producto (nombre, descripcion, precio, categoria, tipo_preparacion, disponible)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.nombre, data.descripcion, data.precio, data.categoria, data.tipo_preparacion, data.disponible]
  );
  return findById(result.insertId);
}

/** RF12 — agregar un insumo a la receta de un producto (upsert de la cantidad). */
async function addRecipeItem(idProducto, idInsumo, cantidadRequerida) {
  await db.execute(
    `INSERT INTO receta (id_producto, id_insumo, cantidad_requerida) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad_requerida = VALUES(cantidad_requerida)`,
    [idProducto, idInsumo, cantidadRequerida]
  );
  return findById(idProducto);
}

/** RF12 — quitar un insumo de la receta de un producto. Devuelve false si no existía esa fila. */
async function removeRecipeItem(idProducto, idInsumo) {
  const result = await db.execute('DELETE FROM receta WHERE id_producto = ? AND id_insumo = ?', [idProducto, idInsumo]);
  return result.affectedRows > 0;
}

/**
 * RF10 — descuenta del inventario los insumos de la receta de un producto,
 * multiplicados por la cantidad vendida (consulta 07). Es una sola sentencia
 * UPDATE...JOIN: MySQL la aplica de forma atómica, así que si algún insumo
 * quedaría bajo cero la restricción CHECK rechaza el UPDATE completo y no
 * queda ningún insumo a medio descontar.
 */
async function sellByRecipe(idProducto, cantidad) {
  const result = await db.execute(
    `UPDATE insumo i
     JOIN receta r ON r.id_insumo = i.id_insumo
     SET i.stock_actual = i.stock_actual - (r.cantidad_requerida * ?)
     WHERE r.id_producto = ?`,
    [cantidad, idProducto]
  );
  return result.affectedRows; // 0 => el producto no existe o no tiene receta
}

/** RF15 — editar un producto (reemplazo completo de los campos editables). Devuelve null si no existe. */
async function update(id, data) {
  const result = await db.execute(
    `UPDATE producto
     SET nombre = ?, descripcion = ?, precio = ?, categoria = ?, tipo_preparacion = ?, disponible = ?
     WHERE id_producto = ?`,
    [data.nombre, data.descripcion, data.precio, data.categoria, data.tipo_preparacion, data.disponible, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

/**
 * RF15 — eliminar un producto. Si ya tiene ventas registradas, la FK
 * (DETALLE_PEDIDO.id_producto, ON DELETE RESTRICT) rechaza el DELETE, según
 * el supuesto del proyecto: un producto vendido no se elimina, se marca
 * disponible = false (con PUT).
 */
async function remove(id) {
  const result = await db.execute('DELETE FROM producto WHERE id_producto = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, remove, addRecipeItem, removeRecipeItem, sellByRecipe, nameExists };
