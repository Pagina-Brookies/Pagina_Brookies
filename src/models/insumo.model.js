'use strict';

const db = require('../config/db');

/** Lista de insumos. Con critical = true solo los que llegaron a su stock mínimo (RF13). */
async function findAll({ critical = false } = {}) {
  const rows = await db.execute(
    `SELECT id_insumo, nombre, unidad_medida, stock_actual, stock_minimo,
            contiene_gluten, contiene_lactosa, es_origen_animal,
            (stock_actual <= stock_minimo) AS critico
     FROM insumo
     ${critical ? 'WHERE stock_actual <= stock_minimo' : ''}
     ORDER BY nombre ASC`
  );
  return rows.map(toInsumo);
}

/** Un insumo por id, o null si no existe. */
async function findById(id) {
  const rows = await db.execute(
    `SELECT id_insumo, nombre, unidad_medida, stock_actual, stock_minimo,
            contiene_gluten, contiene_lactosa, es_origen_animal,
            (stock_actual <= stock_minimo) AS critico
     FROM insumo WHERE id_insumo = ?`,
    [id]
  );
  return rows.length ? toInsumo(rows[0]) : null;
}

/** RF11 — registrar un insumo nuevo. */
async function create(data) {
  const result = await db.execute(
    `INSERT INTO insumo
       (nombre, unidad_medida, stock_actual, stock_minimo, contiene_gluten, contiene_lactosa, es_origen_animal)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.nombre, data.unidad_medida, data.stock_actual, data.stock_minimo,
      data.contiene_gluten, data.contiene_lactosa, data.es_origen_animal]
  );
  return findById(result.insertId);
}

/** RF14 — reabastecer stock (consulta 06: UPDATE simple). Devuelve null si el insumo no existe. */
async function restock(id, cantidad) {
  const result = await db.execute('UPDATE insumo SET stock_actual = stock_actual + ? WHERE id_insumo = ?', [cantidad, id]);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

function toInsumo(r) {
  return {
    ...r,
    contiene_gluten: Boolean(r.contiene_gluten),
    contiene_lactosa: Boolean(r.contiene_lactosa),
    es_origen_animal: Boolean(r.es_origen_animal),
    critico: Boolean(r.critico),
  };
}

module.exports = { findAll, findById, create, restock };
