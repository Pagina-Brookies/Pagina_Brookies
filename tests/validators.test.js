'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProductQuery, parseId, escapeLike } = require('../src/utils/validators');

test('sin parámetros usa los valores por defecto de los filtros obligatorios', () => {
  const { errors, filters } = parseProductQuery({});
  assert.deepEqual(errors, []);
  assert.equal(filters.category, 'todas');
  assert.equal(filters.onlyAvailable, true);
  assert.equal(filters.suitableFor, null);
});

test('acepta filtros opcionales válidos', () => {
  const { errors, filters } = parseProductQuery({
    category: 'Café', available: 'false', name: 'lat', suitable_for: 'vegano', preparation: 'frio', sort: 'precio',
  });
  assert.deepEqual(errors, []);
  assert.equal(filters.category, 'Café');
  assert.equal(filters.onlyAvailable, false);
  assert.equal(filters.suitableFor, 'vegano');
  assert.equal(filters.preparation, 'frio');
  assert.equal(filters.sort, 'precio');
});

test('rechaza valores fuera de la lista y devuelve todos los errores juntos', () => {
  const { errors } = parseProductQuery({ suitable_for: 'keto', preparation: 'tibio', sort: 'popular', available: 'quizas' });
  assert.deepEqual(errors.map((e) => e.field).sort(), ['available', 'preparation', 'sort', 'suitable_for']);
});

test('rechaza un texto de búsqueda demasiado largo', () => {
  const { errors } = parseProductQuery({ name: 'x'.repeat(101) });
  assert.equal(errors[0].field, 'name');
});

test('parseId solo acepta enteros positivos', () => {
  assert.equal(parseId('12'), 12);
  for (const bad of ['0', '-3', '1.5', 'abc', '5 OR 1=1', '']) assert.equal(parseId(bad), null);
});

test('escapeLike neutraliza % y _ ingresados por el usuario', () => {
  assert.equal(escapeLike('100%_ok'), '100\\%\\_ok');
});
