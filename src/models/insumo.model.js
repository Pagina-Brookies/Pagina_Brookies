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
  return rows.map((r) => ({
    ...r,
    contiene_gluten: Boolean(r.contiene_gluten),
    contiene_lactosa: Boolean(r.contiene_lactosa),
    es_origen_animal: Boolean(r.es_origen_animal),
    critico: Boolean(r.critico),
  }));
}

module.exports = { findAll };
