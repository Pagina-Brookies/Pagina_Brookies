'use strict';

const SUITABLE_FOR = ['sin_gluten', 'sin_lactosa', 'vegano'];
const PREPARATION = ['caliente', 'frio'];
const SORT = ['precio', 'mas_vendido'];

/**
 * Valida y normaliza los parámetros de la consulta de productos (GET /api/v1/products).
 * Filtros obligatorios (con valor por defecto): category (todas) y available (true).
 * Filtros opcionales: name, suitable_for, preparation. Orden opcional: sort.
 * Devuelve { errors, filters }. Si hay errores, la API responde 400.
 */
function parseProductQuery(query = {}) {
  const errors = [];
  const filters = {
    category: 'todas',
    onlyAvailable: true,
    name: null,
    suitableFor: null,
    preparation: null,
    sort: null,
  };

  if (query.category !== undefined) {
    const v = String(query.category).trim();
    if (v.length === 0 || v.length > 50) {
      errors.push({ field: 'category', message: 'debe tener entre 1 y 50 caracteres' });
    } else {
      filters.category = v;
    }
  }

  if (query.available !== undefined) {
    const v = String(query.available).toLowerCase();
    if (v !== 'true' && v !== 'false') {
      errors.push({ field: 'available', message: 'debe ser true o false' });
    } else {
      filters.onlyAvailable = v === 'true';
    }
  }

  if (query.name !== undefined) {
    const v = String(query.name).trim();
    if (v.length > 100) {
      errors.push({ field: 'name', message: 'no puede superar los 100 caracteres' });
    } else if (v.length > 0) {
      filters.name = v;
    }
  }

  if (query.suitable_for !== undefined) {
    if (!SUITABLE_FOR.includes(query.suitable_for)) {
      errors.push({ field: 'suitable_for', message: `debe ser uno de: ${SUITABLE_FOR.join(', ')}` });
    } else {
      filters.suitableFor = query.suitable_for;
    }
  }

  if (query.preparation !== undefined) {
    if (!PREPARATION.includes(query.preparation)) {
      errors.push({ field: 'preparation', message: `debe ser uno de: ${PREPARATION.join(', ')}` });
    } else {
      filters.preparation = query.preparation;
    }
  }

  if (query.sort !== undefined) {
    if (!SORT.includes(query.sort)) {
      errors.push({ field: 'sort', message: `debe ser uno de: ${SORT.join(', ')}` });
    } else {
      filters.sort = query.sort;
    }
  }

  return { errors, filters };
}

/** Un id de ruta debe ser un entero positivo. Devuelve el número o null. */
function parseId(value) {
  return /^[1-9][0-9]{0,9}$/.test(String(value)) ? Number(value) : null;
}

/** Escapa % y _ para que un texto del usuario se busque literalmente dentro de un LIKE. */
function escapeLike(text) {
  return String(text).replace(/[\\%_]/g, '\\$&');
}

module.exports = { parseProductQuery, parseId, escapeLike };
