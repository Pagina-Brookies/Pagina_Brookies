'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePositiveInt, parseDecimal, parseText, parseBoolean, parseEnum,
  validateInsumoCreate, validateInsumoUpdate, validateRestock,
  validateProductoCreate, validateProductoUpdate, validateRecetaItem, validateSell,
} = require('../src/utils/validators');

// ---- primitivas: casos adversariales explícitos (letras, negativos, tipos raros) ----

test('parsePositiveInt rechaza negativos, cero, letras y texto mixto', () => {
  for (const bad of [-1, 0, '-5', 'abc', '12abc', '1.5', '', '  ', null, undefined, {}, [], true, '1e5']) {
    assert.equal(parsePositiveInt(bad), null, `debía rechazar ${JSON.stringify(bad)}`);
  }
  assert.equal(parsePositiveInt(5), 5);
  assert.equal(parsePositiveInt('5'), 5);
});

test('parsePositiveInt respeta el tope máximo', () => {
  assert.equal(parsePositiveInt(501, { max: 500 }), null);
  assert.equal(parsePositiveInt(500, { max: 500 }), 500);
});

test('parseDecimal rechaza negativos salvo allowZero, y rechaza texto no numérico', () => {
  for (const bad of [-1, '-1', 'diez', '10,5', '1e10', NaN, Infinity, {}, [], true]) {
    assert.equal(parseDecimal(bad), null, `debía rechazar ${JSON.stringify(bad)}`);
  }
  assert.equal(parseDecimal(0), null); // 0 no permitido por defecto
  assert.equal(parseDecimal(0, { allowZero: true }), 0);
  assert.equal(parseDecimal(-1, { allowZero: true }), null); // allowZero no habilita negativos
  assert.equal(parseDecimal(16), 16);
  assert.equal(parseDecimal('16.5'), 16.5);
  assert.equal(parseDecimal(16.999), 17); // redondea a 2 decimales
});

test('parseDecimal rechaza valores por sobre el máximo de un DECIMAL(10,2)', () => {
  assert.equal(parseDecimal(100000000), null);
});

test('parseText rechaza tipos no string, vacíos y textos demasiado largos', () => {
  assert.equal(parseText(123), null);
  assert.equal(parseText(''), null);
  assert.equal(parseText('   '), null);
  assert.equal(parseText('x'.repeat(101), { maxLen: 100 }), null);
  assert.equal(parseText('  Café molido  '), 'Café molido');
});

test('parseBoolean solo acepta el tipo boolean real, no "true"/1/"si"', () => {
  assert.equal(parseBoolean(true), true);
  assert.equal(parseBoolean(false), false);
  for (const bad of ['true', 'false', 1, 0, 'si', null]) {
    assert.equal(parseBoolean(bad), undefined, `debía marcar inválido ${JSON.stringify(bad)}`);
  }
  assert.equal(parseBoolean(undefined), false); // valor por defecto cuando no se envía
});

test('parseEnum solo acepta valores de la lista', () => {
  assert.equal(parseEnum('Café', ['Café', 'Té']), 'Café');
  assert.equal(parseEnum('café', ['Café', 'Té']), null); // sensible a mayúsculas
  assert.equal(parseEnum(1, ['Café', 'Té']), null);
});

// ---- validadores de recurso completos ----

test('validateInsumoCreate junta todos los errores de un body totalmente inválido', () => {
  const { errors } = validateInsumoCreate({
    nombre: '', unidad_medida: 123, stock_actual: -5, stock_minimo: 'mucho',
    contiene_gluten: 'true', contiene_lactosa: 1, es_origen_animal: false,
  });
  const fields = errors.map((e) => e.field).sort();
  assert.deepEqual(fields, ['contiene_gluten', 'contiene_lactosa', 'nombre', 'stock_actual', 'stock_minimo', 'unidad_medida']);
});

test('validateInsumoCreate acepta un body válido y normaliza los tipos', () => {
  const { errors, data } = validateInsumoCreate({
    nombre: '  Sirope de caramelo  ', unidad_medida: 'ml', stock_actual: 3000, stock_minimo: 500,
    contiene_gluten: false, contiene_lactosa: false, es_origen_animal: false,
  });
  assert.deepEqual(errors, []);
  assert.equal(data.nombre, 'Sirope de caramelo');
  assert.equal(data.stock_actual, 3000);
});

test('validateRestock rechaza cantidades negativas, cero y no numéricas', () => {
  assert.equal(validateRestock({ cantidad: -10 }).errors.length, 1);
  assert.equal(validateRestock({ cantidad: 0 }).errors.length, 1);
  assert.equal(validateRestock({ cantidad: 'cien' }).errors.length, 1);
  assert.equal(validateRestock({}).errors.length, 1);
  assert.equal(validateRestock({ cantidad: 100 }).errors.length, 0);
});

test('validateProductoCreate exige categoría de la lista fija y precio positivo', () => {
  const bad = validateProductoCreate({ nombre: 'Mocha', precio: -100, categoria: 'Bebida', disponible: true });
  assert.deepEqual(bad.errors.map((e) => e.field).sort(), ['categoria', 'precio']);

  const good = validateProductoCreate({ nombre: 'Mocha', precio: 3100, categoria: 'Café', disponible: true });
  assert.deepEqual(good.errors, []);
  assert.equal(good.data.tipo_preparacion, 'no_aplica'); // valor por defecto
});

test('validateRecetaItem exige id_insumo entero positivo y cantidad positiva', () => {
  assert.equal(validateRecetaItem({ id_insumo: -1, cantidad_requerida: 10 }).errors.length, 1);
  assert.equal(validateRecetaItem({ id_insumo: 'uno', cantidad_requerida: 10 }).errors.length, 1);
  assert.equal(validateRecetaItem({ id_insumo: 1, cantidad_requerida: -5 }).errors.length, 1);
  assert.equal(validateRecetaItem({ id_insumo: 1, cantidad_requerida: 16 }).errors.length, 0);
});

test('validateSell limita la cantidad a un entero razonable (1 a 500)', () => {
  assert.equal(validateSell({ cantidad: 0 }).errors.length, 1);
  assert.equal(validateSell({ cantidad: -3 }).errors.length, 1);
  assert.equal(validateSell({ cantidad: 501 }).errors.length, 1);
  assert.equal(validateSell({ cantidad: 'muchos' }).errors.length, 1);
  assert.equal(validateSell({ cantidad: 500 }).errors.length, 0);
});

test('validateInsumoUpdate (PUT) exige el recurso completo, igual que al crear', () => {
  assert.equal(validateInsumoUpdate, validateInsumoCreate);
  const bad = validateInsumoUpdate({ nombre: 'X', unidad_medida: 'g', stock_actual: -1, stock_minimo: 1, contiene_gluten: false, contiene_lactosa: false, es_origen_animal: false });
  assert.equal(bad.errors.length, 1);
});

test('validateProductoUpdate (PUT) exige el recurso completo, igual que al crear', () => {
  assert.equal(validateProductoUpdate, validateProductoCreate);
  const bad = validateProductoUpdate({ nombre: 'X', precio: 0, categoria: 'Café', disponible: true });
  assert.equal(bad.errors.length, 1); // precio debe ser > 0, no admite 0
});
