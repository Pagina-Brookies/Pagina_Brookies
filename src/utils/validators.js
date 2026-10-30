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

/** Precio en pesos chilenos: entero mayor a 0 (el CLP no tiene decimales). */
function parsePrice(value) {
  return parsePositiveInt(value, { max: 99999999 });
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

/**
 * POST /api/v1/supplies (y PUT con strict = true).
 * En PUT las marcas de alérgenos son obligatorias: si faltaran se guardarían como false
 * y un insumo con lactosa quedaría como libre de lactosa.
 */
function validateInsumoCreate(body = {}, { strict = false } = {}) {
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
    const v = parseBoolean(body[flag], { required: strict });
    if (v === undefined) errors.push({ field: flag, message: strict ? 'requerido en PUT: true o false' : 'debe ser true o false' });
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

/**
 * POST /api/v1/products (y PUT con strict = true).
 * En PUT, descripcion, tipo_preparacion y disponible son obligatorios: si faltaran se
 * guardarían null / 'no_aplica' / false y un PUT que solo cambia el nombre escondería el producto.
 */
function validateProductoCreate(body = {}, { strict = false } = {}) {
  const errors = [];
  const out = {};

  out.nombre = parseText(body.nombre, { maxLen: 100 });
  if (out.nombre === null) errors.push({ field: 'nombre', message: 'texto requerido, de 1 a 100 caracteres' });

  if (strict && body.descripcion === undefined) {
    errors.push({ field: 'descripcion', message: 'requerido en PUT (use null para dejarla vacía)' });
  } else if (body.descripcion !== undefined && body.descripcion !== null) {
    out.descripcion = parseText(body.descripcion, { maxLen: 300, minLen: 0 });
    if (out.descripcion === null) errors.push({ field: 'descripcion', message: 'no puede superar los 300 caracteres' });
  } else {
    out.descripcion = null;
  }

  out.precio = parsePrice(body.precio);
  if (out.precio === null) errors.push({ field: 'precio', message: 'debe ser un entero mayor a 0 (pesos chilenos, sin decimales)' });

  out.categoria = parseLooseEnum(body.categoria, CATEGORIES);
  if (out.categoria === null) errors.push({ field: 'categoria', message: `debe ser una de: ${CATEGORIES.join(', ')}` });

  if (body.tipo_preparacion === undefined && !strict) {
    out.tipo_preparacion = 'no_aplica';
  } else {
    out.tipo_preparacion = parseLooseEnum(body.tipo_preparacion, PREPARATION);
    if (out.tipo_preparacion === null) errors.push({ field: 'tipo_preparacion', message: `debe ser uno de: ${PREPARATION.join(', ')}` });
  }

  out.disponible = parseBoolean(body.disponible, { required: strict });
  if (out.disponible === undefined) errors.push({ field: 'disponible', message: strict ? 'requerido en PUT: true o false' : 'debe ser true o false' });

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


// ------------------------------------------------------------------------
// Entrega 2: autenticación, perfil, pedidos
// ------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ORDER_STATES = ['recibido', 'en_preparacion', 'listo'];

/** Contraseña: mínimo 8 caracteres y al menos un número (la regla se muestra antes de escribir, en el formulario). */
function parsePassword(value) {
  if (typeof value !== 'string') return null;
  if (value.length < 8 || value.length > 72 || !/\d/.test(value)) return null; // 72 bytes: tope de bcrypt
  return value;
}

function parseEmail(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return v.length <= 150 && EMAIL_RE.test(v) ? v : null;
}

/** Texto opcional: ausente, null o vacío => null; presente pero demasiado largo => undefined (error). */
function parseOptionalText(value, maxLen) {
  if (value === undefined || value === null || value === '') return null;
  const t = parseText(value, { maxLen });
  return t === null ? undefined : t;
}

/** POST /api/v1/auth/register (RF01) */
function validateRegister(body = {}) {
  const errors = [];
  const nombre = parseText(body.nombre, { maxLen: 100 });
  if (nombre === null) errors.push({ field: 'nombre', message: 'texto requerido, de 1 a 100 caracteres' });
  const correo = parseEmail(body.correo);
  if (correo === null) errors.push({ field: 'correo', message: 'debe ser un correo válido, por ejemplo nombre@dominio.cl' });
  const contrasena = parsePassword(body.contrasena);
  if (contrasena === null) errors.push({ field: 'contrasena', message: 'mínimo 8 caracteres, con al menos un número' });
  const telefono = parseOptionalText(body.telefono, 20);
  if (telefono === undefined) errors.push({ field: 'telefono', message: 'no puede superar los 20 caracteres' });
  const direccion = parseOptionalText(body.direccion, 200);
  if (direccion === undefined) errors.push({ field: 'direccion', message: 'no puede superar los 200 caracteres' });
  return { errors, data: { nombre, correo, contrasena, telefono, direccion } };
}

/** POST /api/v1/auth/login (RF02) */
function validateLogin(body = {}) {
  const errors = [];
  const correo = parseEmail(body.correo);
  if (correo === null) errors.push({ field: 'correo', message: 'debe ser un correo válido' });
  if (typeof body.contrasena !== 'string' || body.contrasena.length === 0 || body.contrasena.length > 72) {
    errors.push({ field: 'contrasena', message: 'requerida' });
  }
  return { errors, data: { correo, contrasena: body.contrasena } };
}

/** PUT /api/v1/me (RF03): datos personales editables. */
function validateProfile(body = {}) {
  const errors = [];
  const nombre = parseText(body.nombre, { maxLen: 100 });
  if (nombre === null) errors.push({ field: 'nombre', message: 'texto requerido, de 1 a 100 caracteres' });
  const telefono = parseOptionalText(body.telefono, 20);
  if (telefono === undefined) errors.push({ field: 'telefono', message: 'no puede superar los 20 caracteres' });
  const direccion = parseOptionalText(body.direccion, 200);
  if (direccion === undefined) errors.push({ field: 'direccion', message: 'no puede superar los 200 caracteres' });
  return { errors, data: { nombre, telefono, direccion } };
}

/** POST /api/v1/orders/reservations (RF05, RF07): el carrito que se quiere pagar. */
function validateCart(body = {}) {
  const errors = [];
  const items = [];
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    errors.push({ field: 'items', message: 'debe ser una lista de 1 a 50 productos' });
    return { errors, data: { items } };
  }
  const seen = new Set();
  body.items.forEach((it, i) => {
    const producto_id = parsePositiveInt(it && it.producto_id);
    const cantidad = parsePositiveInt(it && it.cantidad, { max: 50 });
    if (producto_id === null) errors.push({ field: `items[${i}].producto_id`, message: 'debe ser un entero positivo' });
    if (cantidad === null) errors.push({ field: `items[${i}].cantidad`, message: 'debe ser un entero entre 1 y 50' });
    if (producto_id !== null && seen.has(producto_id)) errors.push({ field: `items[${i}].producto_id`, message: 'producto repetido: sume las cantidades en una sola línea' });
    if (producto_id !== null) seen.add(producto_id);
    if (producto_id !== null && cantidad !== null) items.push({ producto_id, cantidad });
  });
  return { errors, data: { items } };
}

/**
 * POST /api/v1/orders/reservations/:id/pay (RF06).
 * El sistema usa una pasarela simulada (sandbox): recibe el número solo para decidir el resultado
 * y NUNCA lo guarda (RNF01). Un número que termina en 0002 se rechaza; cualquier otro se aprueba.
 */
function validatePayment(body = {}) {
  const errors = [];
  const raw = typeof body.numero_tarjeta === 'string' ? body.numero_tarjeta.replace(/[\s-]/g, '') : '';
  if (!/^\d{13,19}$/.test(raw)) errors.push({ field: 'numero_tarjeta', message: 'debe tener entre 13 y 19 dígitos' });
  return { errors, data: { numero_tarjeta: raw } };
}

/** PATCH /api/v1/orders/:id/status (RF18) */
function validateStatus(body = {}) {
  const errors = [];
  const estado = parseEnum(body.estado, ORDER_STATES);
  if (estado === null) errors.push({ field: 'estado', message: `debe ser uno de: ${ORDER_STATES.join(', ')}` });
  return { errors, data: { estado } };
}

/** Filtro opcional ?estado= del listado de pedidos del administrador. */
function parseOrderFilter(query = {}) {
  if (query.estado === undefined) return { errors: [], estado: null };
  const estado = parseEnum(query.estado, ORDER_STATES);
  return estado === null
    ? { errors: [{ field: 'estado', message: `debe ser uno de: ${ORDER_STATES.join(', ')}` }], estado: null }
    : { errors: [], estado };
}

module.exports = {
  validateRegister, validateLogin, validateProfile, validateCart, validatePayment, validateStatus, parseOrderFilter, parsePassword, parseEmail, ORDER_STATES,
  parseProductQuery, parseId, escapeLike,
  parseInteger, parsePositiveInt, parseDecimal, parsePrice, parseText, parseBoolean, parseEnum,
  validateInsumoCreate, validateRestock, validateProductoCreate, validateRecetaItem, validateSell,
  // PUT reemplaza el recurso completo: exige TODOS los campos, sin valores por defecto.
  validateInsumoUpdate: (body) => validateInsumoCreate(body, { strict: true }),
  validateProductoUpdate: (body) => validateProductoCreate(body, { strict: true }),
  CATEGORIES, PREPARATION, SUITABLE_FOR, UNITS, normalize, parseLooseEnum,
};
