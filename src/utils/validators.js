'use strict';

const SUITABLE_FOR = ['sin_gluten', 'sin_lactosa', 'vegano'];
const PREPARATION = ['caliente', 'frio', 'no_aplica'];
const SORT = ['precio', 'mas_vendido'];
const CATEGORIES = ['Café', 'Té', 'Galleta'];
const UNITS = ['g', 'kg', 'ml', 'l', 'unidad'];

/** Quita tildes y pasa a minúsculas, para comparar sin importar cómo se escribió ("cafe" = "Café"). */
function normalize(text) {
  return String(text).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Devuelve el valor oficial de la lista si coincide sin importar mayúsculas ni tildes; si no, null. */
function parseLooseEnum(value, allowed) {
  if (typeof value !== 'string') return null;
  const n = normalize(value);
  return allowed.find((a) => normalize(a) === n) || null;
}

// ------------------------------------------------------------------------
// Primitivas de validación. Se usan en el cuerpo (JSON) y en la query
// string de las peticiones. Nunca confían en el tipo que declara el
// cliente: siempre revisan el valor real antes de usarlo en una consulta.
// ------------------------------------------------------------------------

/** Entero seguro a partir de un valor JSON (number) o de query string (string). null si no calza. */
function parseInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^-?\d+$/.test(v)) return null; // rechaza letras, espacios internos, "12abc", "1e5", etc.
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

/** Entero positivo (> 0), con un tope razonable para no aceptar valores absurdos. */
function parsePositiveInt(value, { max = 100000 } = {}) {
  const n = parseInteger(value);
  if (n === null || n <= 0 || n > max) return null;
  return n;
}

/**
 * Decimal para columnas DECIMAL(10,2): hasta 2 decimales, sin notación
 * científica, dentro del rango que la columna puede guardar. Rechaza
 * negativos salvo que allowZero/min lo permitan explícitamente.
 */
function parseDecimal(value, { allowZero = false, max = 99999999.99 } = {}) {
  let n;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && /^-?\d+(\.\d{1,2})?$/.test(value.trim())) {
    n = Number(value.trim());
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  // más de 2 decimales (ej. 16.999) se rechaza: la columna es DECIMAL(10,2)
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  if (n > max) return null;
  return Math.round(n * 100) / 100;
}

/** Texto no vacío, recortado, dentro de un largo máximo (según la columna VARCHAR). */
function parseText(value, { maxLen = 255, minLen = 1 } = {}) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v.length < minLen || v.length > maxLen) return null;
  return v;
}

/** Booleano estricto: solo acepta el tipo boolean real del JSON (no "true"/1/"si"). */
function parseBoolean(value, { required = false } = {}) {
  if (typeof value === 'boolean') return value;
  if (value === undefined && !required) return false; // default de los flags de INSUMO
  return undefined; // valor presente pero de tipo incorrecto
}

/** Valor dentro de una lista fija (categoría, tipo_preparacion, etc.). */
function parseEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}


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
    const raw = String(query.category);
    if (normalize(raw) === 'todas') {
      filters.category = 'todas';
    } else {
      const c = parseLooseEnum(raw, CATEGORIES);
      if (c === null) {
        errors.push({ field: 'category', message: `debe ser una de: todas, ${CATEGORIES.join(', ')}` });
      } else {
        filters.category = c;
      }
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

// ------------------------------------------------------------------------
// Validadores de cuerpo (JSON) por recurso. Cada uno junta TODOS los
// errores del cuerpo en un solo arreglo (como exige la clase 03), en vez
// de cortar en el primer campo malo.
// ------------------------------------------------------------------------

/** POST /api/v1/supplies */
function validateInsumoCreate(body = {}) {
  const errors = [];
  const out = {};

  out.nombre = parseText(body.nombre, { maxLen: 100 });
  if (out.nombre === null) errors.push({ field: 'nombre', message: 'texto requerido, de 1 a 100 caracteres' });

  out.unidad_medida = parseLooseEnum(body.unidad_medida, UNITS);
  if (out.unidad_medida === null) errors.push({ field: 'unidad_medida', message: `debe ser una de: ${UNITS.join(', ')}` });

  out.stock_actual = parseDecimal(body.stock_actual, { allowZero: true });
  if (out.stock_actual === null) errors.push({ field: 'stock_actual', message: 'debe ser un número mayor o igual a 0, con máximo 2 decimales' });

  out.stock_minimo = parseDecimal(body.stock_minimo, { allowZero: true });
  if (out.stock_minimo === null) errors.push({ field: 'stock_minimo', message: 'debe ser un número mayor o igual a 0, con máximo 2 decimales' });

  for (const flag of ['contiene_gluten', 'contiene_lactosa', 'es_origen_animal']) {
    const v = parseBoolean(body[flag]);
    if (v === undefined) errors.push({ field: flag, message: 'debe ser true o false' });
    else out[flag] = v;
  }

  return { errors, data: out };
}

/** PATCH /api/v1/supplies/:id/restock */
function validateRestock(body = {}) {
  const errors = [];
  const cantidad = parseDecimal(body.cantidad, { allowZero: false });
  if (cantidad === null) errors.push({ field: 'cantidad', message: 'debe ser un número mayor a 0, con máximo 2 decimales' });
  return { errors, data: { cantidad } };
}

/** POST /api/v1/products */
function validateProductoCreate(body = {}) {
  const errors = [];
  const out = {};

  out.nombre = parseText(body.nombre, { maxLen: 100 });
  if (out.nombre === null) errors.push({ field: 'nombre', message: 'texto requerido, de 1 a 100 caracteres' });

  if (body.descripcion !== undefined && body.descripcion !== null) {
    out.descripcion = parseText(body.descripcion, { maxLen: 300, minLen: 0 });
    if (out.descripcion === null) errors.push({ field: 'descripcion', message: 'no puede superar los 300 caracteres' });
  } else {
    out.descripcion = null;
  }

  out.precio = parseDecimal(body.precio);
  if (out.precio === null) errors.push({ field: 'precio', message: 'debe ser un número mayor a 0, con máximo 2 decimales' });

  out.categoria = parseLooseEnum(body.categoria, CATEGORIES);
  if (out.categoria === null) errors.push({ field: 'categoria', message: `debe ser una de: ${CATEGORIES.join(', ')}` });

  out.tipo_preparacion = body.tipo_preparacion === undefined ? 'no_aplica' : parseLooseEnum(body.tipo_preparacion, PREPARATION);
  if (out.tipo_preparacion === null) errors.push({ field: 'tipo_preparacion', message: `debe ser uno de: ${PREPARATION.join(', ')}` });

  out.disponible = parseBoolean(body.disponible);
  if (out.disponible === undefined) errors.push({ field: 'disponible', message: 'debe ser true o false' });

  return { errors, data: out };
}

/** POST /api/v1/products/:id/recipe */
function validateRecetaItem(body = {}) {
  const errors = [];
  const id_insumo = parsePositiveInt(body.id_insumo);
  if (id_insumo === null) errors.push({ field: 'id_insumo', message: 'debe ser un entero positivo' });

  const cantidad_requerida = parseDecimal(body.cantidad_requerida);
  if (cantidad_requerida === null) errors.push({ field: 'cantidad_requerida', message: 'debe ser un número mayor a 0, con máximo 2 decimales' });

  return { errors, data: { id_insumo, cantidad_requerida } };
}

/** POST /api/v1/products/:id/sell */
function validateSell(body = {}) {
  const errors = [];
  const cantidad = parsePositiveInt(body.cantidad, { max: 500 });
  if (cantidad === null) errors.push({ field: 'cantidad', message: 'debe ser un entero entre 1 y 500' });
  return { errors, data: { cantidad } };
}

module.exports = {
  parseProductQuery, parseId, escapeLike,
  parseInteger, parsePositiveInt, parseDecimal, parseText, parseBoolean, parseEnum,
  validateInsumoCreate, validateRestock, validateProductoCreate, validateRecetaItem, validateSell,
  // PUT reemplaza el recurso completo, así que exige los mismos campos que crear uno nuevo.
  validateInsumoUpdate: validateInsumoCreate,
  validateProductoUpdate: validateProductoCreate,
  CATEGORIES, PREPARATION, SUITABLE_FOR, UNITS, normalize, parseLooseEnum,
};
