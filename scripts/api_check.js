'use strict';

/**
 * Pruebas de la API de punta a punta, contra un servidor corriendo.
 *   npm run test:api                                   -> contra http://localhost:3000
 *   API_URL=https://brookies-coffee-api.onrender.com npm run test:api   -> contra producción
 *
 * No deja basura: los insumos y productos que crea para probar se borran al final.
 * No vende ni reabastece con éxito (eso cambiaría el stock real); solo prueba que
 * las ventas y reabastecimientos inválidos se rechacen.
 */
require('dotenv').config();

const BASE = (process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const TAG = `QA-${Date.now()}`;
let pass = 0;
let failCount = 0;
const failures = [];

async function call(method, path, body, rawBody) {
  const opts = { method, headers: {} };
  if (rawBody !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = rawBody;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, json };
}

async function expect(label, expected, method, path, body, rawBody) {
  const r = await call(method, path, body, rawBody);
  const ok = Array.isArray(expected) ? expected.includes(r.status) : r.status === expected;
  const shapeOk = r.json && 'data' in r.json && Array.isArray(r.json.errors);
  if (ok && shapeOk) {
    pass++;
    console.log(`  ok   ${String(r.status).padEnd(3)} ${label}`);
  } else {
    failCount++;
    const why = !shapeOk ? 'respuesta sin la forma {data, errors}' : `esperaba ${expected}, llegó ${r.status}`;
    failures.push(`${label} — ${why}`);
    console.log(`  FALLA ${String(r.status).padEnd(3)} ${label}  (${why})`);
  }
  return r;
}

// Casos con texto de ataque (inyección SQL). En producción hay un firewall (Cloudflare) delante de Render que
// puede bloquearlos con un 403 antes de que lleguen a la API: eso también es una respuesta segura.
async function expectInjection(label, expected, method, path) {
  const res = await fetch(BASE + path, { method });
  let json = null;
  try { json = await res.json(); } catch { /* respuesta que no es JSON */ }
  const shapeOk = json && 'data' in json && Array.isArray(json.errors);
  const blockedByEdge = res.status === 403 && !shapeOk && Boolean(res.headers.get('cf-ray'));
  if (shapeOk && res.status === expected) {
    pass++;
    console.log(`  ok   ${String(res.status).padEnd(3)} ${label}`);
  } else if (blockedByEdge) {
    pass++;
    console.log(`  ok   403 ${label}  (bloqueada por el firewall de Cloudflare antes de llegar a la API)`);
  } else {
    failCount++;
    const why = !shapeOk ? `llegó ${res.status} sin la forma {data, errors}` : `esperaba ${expected}, llegó ${res.status}`;
    failures.push(`${label} — ${why}`);
    console.log(`  FALLA ${String(res.status).padEnd(3)} ${label}  (${why})`);
  }
}

const validSupply = (over = {}) => ({
  nombre: `${TAG} insumo`, unidad_medida: 'g', stock_actual: 100, stock_minimo: 10,
  contiene_gluten: false, contiene_lactosa: false, es_origen_animal: false, ...over,
});
const validProduct = (over = {}) => ({
  nombre: `${TAG} producto`, descripcion: 'prueba automática', precio: 1500,
  categoria: 'Galleta', tipo_preparacion: 'no_aplica', disponible: true, ...over,
});

async function main() {
  console.log(`Probando ${BASE}\n`);

  console.log('Sistema');
  await expect('GET /health', 200, 'GET', '/health');
  await expect('ruta inexistente', 404, 'GET', '/api/v1/nada');
  const spec = await fetch(`${BASE}/api-docs.json`).then((r) => r.json()).catch(() => null);
  if (spec && spec.openapi && spec.paths && Object.keys(spec.paths).length >= 11) { pass++; console.log('  ok   200 spec de Swagger (/api-docs.json)'); }
  else { failCount++; failures.push('spec de Swagger no disponible o incompleto'); console.log('  FALLA spec de Swagger'); }

  console.log('\nConsulta de productos (filtros)');
  const all = await expect('sin filtros', 200, 'GET', '/api/v1/products');
  await expect('categoría "cafe" sin tilde', 200, 'GET', '/api/v1/products?category=cafe');
  await expect('categoría inexistente', 400, 'GET', '/api/v1/products?category=Bebida');
  await expect('categoría "-1"', 400, 'GET', '/api/v1/products?category=-1');
  await expect('available=quizas', 400, 'GET', '/api/v1/products?available=quizas');
  await expect('suitable_for=keto', 400, 'GET', '/api/v1/products?suitable_for=keto');
  await expect('preparation=tibio', 400, 'GET', '/api/v1/products?preparation=tibio');
  await expect('sort=barato', 400, 'GET', '/api/v1/products?sort=barato');
  await expect('name de 101 caracteres', 400, 'GET', `/api/v1/products?name=${'a'.repeat(101)}`);
  await expect('name con % (no rompe el LIKE)', 200, 'GET', '/api/v1/products?name=%25');
  await expectInjection('name con intento de inyección', 200, 'GET', `/api/v1/products?name=${encodeURIComponent("' OR 1=1 --")}`);
  const veg = await expect('vegano + caliente + precio', 200, 'GET', '/api/v1/products?suitable_for=vegano&preparation=caliente&sort=precio');
  if (veg.json && Array.isArray(veg.json.data)) {
    const wrong = veg.json.data.filter((p) => !(p.apto_para || []).includes('vegano'));
    if (wrong.length) { failCount++; failures.push('filtro vegano devolvió productos no veganos'); console.log('  FALLA filtro vegano devolvió productos no veganos'); } else { pass++; console.log('  ok       todos los resultados veganos traen apto_para: vegano'); }
  }
  if (all.json && Array.isArray(all.json.data) && all.json.data[0] && !Array.isArray(all.json.data[0].apto_para)) {
    failCount++; failures.push('los productos no traen el campo apto_para');
  }

  console.log('\nProducto por id');
  await expect('id=1', 200, 'GET', '/api/v1/products/1');
  await expect('id=abc', 400, 'GET', '/api/v1/products/abc');
  await expect('id=-5', 400, 'GET', '/api/v1/products/-5');
  await expect('id=0', 400, 'GET', '/api/v1/products/0');
  await expect('id=1.5', 400, 'GET', '/api/v1/products/1.5');
  await expectInjection('id con inyección', 400, 'GET', '/api/v1/products/1%20OR%201=1');
  await expect('id=99999 (no existe)', 404, 'GET', '/api/v1/products/99999');

  console.log('\nCrear producto (datos inválidos)');
  await expect('body vacío', 400, 'POST', '/api/v1/products', {});
  await expect('JSON mal escrito', 400, 'POST', '/api/v1/products', undefined, '{"nombre": Mocha}');
  await expect('precio negativo', 400, 'POST', '/api/v1/products', validProduct({ precio: -100 }));
  await expect('precio 0', 400, 'POST', '/api/v1/products', validProduct({ precio: 0 }));
  await expect('precio como texto', 400, 'POST', '/api/v1/products', validProduct({ precio: 'caro' }));
  await expect('precio con 3 decimales', 400, 'POST', '/api/v1/products', validProduct({ precio: 10.999 }));
  await expect('precio absurdo (1e12)', 400, 'POST', '/api/v1/products', validProduct({ precio: 1e12 }));
  await expect('categoría inexistente', 400, 'POST', '/api/v1/products', validProduct({ categoria: 'Bebida' }));
  await expect('categoría "-1"', 400, 'POST', '/api/v1/products', validProduct({ categoria: '-1' }));
  await expect('tipo_preparacion inválido', 400, 'POST', '/api/v1/products', validProduct({ tipo_preparacion: 'tibio' }));
  await expect('disponible como texto "true"', 400, 'POST', '/api/v1/products', validProduct({ disponible: 'true' }));
  await expect('nombre solo espacios', 400, 'POST', '/api/v1/products', validProduct({ nombre: '   ' }));
  await expect('nombre de 101 caracteres', 400, 'POST', '/api/v1/products', validProduct({ nombre: 'x'.repeat(101) }));
  await expect('descripción de 301 caracteres', 400, 'POST', '/api/v1/products', validProduct({ descripcion: 'x'.repeat(301) }));
  await expect('nombre duplicado (Espresso)', 409, 'POST', '/api/v1/products', validProduct({ nombre: 'espresso' }));
  await expect('cuerpo de más de 100 kB', 413, 'POST', '/api/v1/products', undefined, JSON.stringify({ nombre: 'x'.repeat(200000) }));

  console.log('\nCrear, editar y borrar producto (válido)');
  const created = await expect('crear producto válido ("galleta" en minúscula)', 201, 'POST', '/api/v1/products', validProduct({ categoria: 'galleta' }));
  const pid = created.json && created.json.data && created.json.data.id_producto;
  if (pid) {
    if (created.json.data.categoria !== 'Galleta') { failCount++; failures.push('categoría no se guardó con el valor oficial'); }
    await expect('editar producto', 200, 'PUT', `/api/v1/products/${pid}`, validProduct({ precio: 1600 }));
    await expect('editar con nombre de otro producto', 409, 'PUT', `/api/v1/products/${pid}`, validProduct({ nombre: 'Latte' }));
    await expect('editar producto inexistente', 404, 'PUT', '/api/v1/products/99999', validProduct({ nombre: `${TAG} otro` }));
    await expect('vender producto sin receta', 422, 'POST', `/api/v1/products/${pid}/sell`, { cantidad: 1 });
  }

  console.log('\nVentas (solo casos que deben rechazarse)');
  await expect('cantidad negativa', 400, 'POST', '/api/v1/products/1/sell', { cantidad: -3 });
  await expect('cantidad 0', 400, 'POST', '/api/v1/products/1/sell', { cantidad: 0 });
  await expect('cantidad 1.5', 400, 'POST', '/api/v1/products/1/sell', { cantidad: 1.5 });
  await expect('cantidad 501', 400, 'POST', '/api/v1/products/1/sell', { cantidad: 501 });
  await expect('cantidad como texto', 400, 'POST', '/api/v1/products/1/sell', { cantidad: 'muchos' });
  await expect('vender más de lo que alcanza el stock (Matcha x500)', 422, 'POST', '/api/v1/products/7/sell', { cantidad: 500 });
  await expect('vender producto no disponible (id 12)', 422, 'POST', '/api/v1/products/12/sell', { cantidad: 1 });
  await expect('vender producto inexistente', 404, 'POST', '/api/v1/products/99999/sell', { cantidad: 1 });

  console.log('\nRecetas');
  await expect('insumo inexistente', 400, 'POST', '/api/v1/products/1/recipe', { id_insumo: 9999, cantidad_requerida: 10 });
  await expect('id_insumo negativo', 400, 'POST', '/api/v1/products/1/recipe', { id_insumo: -1, cantidad_requerida: 10 });
  await expect('cantidad_requerida negativa', 400, 'POST', '/api/v1/products/1/recipe', { id_insumo: 1, cantidad_requerida: -5 });
  await expect('producto inexistente', 404, 'POST', '/api/v1/products/99999/recipe', { id_insumo: 1, cantidad_requerida: 5 });
  await expect('quitar combinación que no existe', 404, 'DELETE', '/api/v1/products/1/recipe/8');

  console.log('\nInsumos (datos inválidos)');
  await expect('stock negativo', 400, 'POST', '/api/v1/supplies', validSupply({ stock_actual: -10 }));
  await expect('stock como texto', 400, 'POST', '/api/v1/supplies', validSupply({ stock_actual: 'asas' }));
  await expect('stock_minimo como texto', 400, 'POST', '/api/v1/supplies', validSupply({ stock_minimo: 'asdasda' }));
  await expect('unidad_medida "a"', 400, 'POST', '/api/v1/supplies', validSupply({ unidad_medida: 'a' }));
  await expect('unidad_medida numérica', 400, 'POST', '/api/v1/supplies', validSupply({ unidad_medida: 5 }));
  await expect('contiene_gluten como texto', 400, 'POST', '/api/v1/supplies', validSupply({ contiene_gluten: 'true' }));
  await expect('contiene_lactosa como 1', 400, 'POST', '/api/v1/supplies', validSupply({ contiene_lactosa: 1 }));
  await expect('nombre duplicado (café molido)', 409, 'POST', '/api/v1/supplies', validSupply({ nombre: 'café molido' }));
  await expect('critical=quizas', 400, 'GET', '/api/v1/supplies?critical=quizas');
  await expect('insumos críticos', 200, 'GET', '/api/v1/supplies?critical=true');

  console.log('\nReabastecer (solo casos que deben rechazarse)');
  await expect('cantidad negativa', 400, 'PATCH', '/api/v1/supplies/1/restock', { cantidad: -50 });
  await expect('cantidad 0', 400, 'PATCH', '/api/v1/supplies/1/restock', { cantidad: 0 });
  await expect('cantidad como texto', 400, 'PATCH', '/api/v1/supplies/1/restock', { cantidad: 'cien' });
  await expect('cantidad que desborda la columna', 422, 'PATCH', '/api/v1/supplies/1/restock', { cantidad: 99999999.99 });
  await expect('insumo inexistente', 404, 'PATCH', '/api/v1/supplies/99999/restock', { cantidad: 10 });

  console.log('\nCrear, editar y borrar insumo (válido)');
  const sup = await expect('crear insumo válido (unidad "ML" en mayúscula)', 201, 'POST', '/api/v1/supplies', validSupply({ unidad_medida: 'ML' }));
  const sid = sup.json && sup.json.data && sup.json.data.id_insumo;
  if (sid) {
    if (sup.json.data.unidad_medida !== 'ml') { failCount++; failures.push('unidad_medida no se guardó normalizada'); }
    await expect('editar insumo', 200, 'PUT', `/api/v1/supplies/${sid}`, validSupply({ stock_minimo: 20 }));
    await expect('editar con nombre de otro insumo', 409, 'PUT', `/api/v1/supplies/${sid}`, validSupply({ nombre: 'Azúcar' }));
    if (pid) {
      await expect('agregar el insumo a la receta de prueba', 201, 'POST', `/api/v1/products/${pid}/recipe`, { id_insumo: sid, cantidad_requerida: 5 });
      await expect('borrar insumo en uso en una receta', 409, 'DELETE', `/api/v1/supplies/${sid}`);
      await expect('quitar el insumo de la receta', 200, 'DELETE', `/api/v1/products/${pid}/recipe/${sid}`);
    }
    await expect('borrar insumo de prueba', 200, 'DELETE', `/api/v1/supplies/${sid}`);
    await expect('borrarlo de nuevo', 404, 'DELETE', `/api/v1/supplies/${sid}`);
  }
  await expect('borrar insumo en uso (Café molido)', 409, 'DELETE', '/api/v1/supplies/1');

  console.log('\nBorrado de productos');
  await expect('borrar producto con ventas (Espresso)', 409, 'DELETE', '/api/v1/products/1');
  if (pid) {
    await expect('borrar producto de prueba', 200, 'DELETE', `/api/v1/products/${pid}`);
    await expect('borrarlo de nuevo', 404, 'DELETE', `/api/v1/products/${pid}`);
  }
  await expect('borrar con id inválido', 400, 'DELETE', '/api/v1/products/abc');

  console.log('\nReportes');
  await expect('más vendidos', 200, 'GET', '/api/v1/reports/top-products');
  await expect('insumos críticos y sus productos', 200, 'GET', '/api/v1/reports/critical-supplies');

  console.log(`\n${pass} correctas, ${failCount} con problemas.`);
  if (failures.length) {
    console.log('\nRevisar:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nNo se pudo conectar a ${BASE}: ${err.message}`);
  console.error('¿Está corriendo el servidor? (npm start) — o define API_URL para probar producción.');
  process.exit(1);
});
