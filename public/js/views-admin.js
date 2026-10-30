import { get, post, put, patch, del } from './api.js';
import { h, clp, fecha, num, toast, alerta, mostrarErrores, campo, skeletons, vacio, ocupado, estadoTag, ESTADOS } from './ui.js';

const aviso = () => h('div', { class: 'aviso', 'aria-live': 'polite' });

export function pestanas(actual) {
  const items = [['pedidos', 'Pedidos'], ['insumos', 'Insumos'], ['menu', 'Menú y recetas'], ['reportes', 'Reportes y consultas']];
  return h('nav', { class: 'tabs', 'aria-label': 'Administración' },
    items.map(([k, t]) => h('a', { href: `#/admin/${k}`, 'aria-current': k === actual ? 'page' : false }, t)));
}

// ------------------------------------------------------------------ Pedidos (RF18)
export async function adminPedidos(root, nav) {
  const SIG = { recibido: 'en_preparacion', en_preparacion: 'listo' };
  let filtro = '';
  const av = aviso();
  const cuerpo = h('div', { 'aria-live': 'polite' });
  const sel = campo({ id: 'filtro-estado', label: 'Filtrar por estado', options: [['', 'Todos'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v[0]])] });
  sel.addEventListener('input', (e) => { filtro = e.target.value; cargar(); });

  async function avanzar(p, btn) {
    ocupado(btn, 'Guardando…', async () => {
      try { await patch(`/api/v1/orders/${p.id_pedido}/status`, { estado: SIG[p.estado] }); toast(`Pedido ${p.id_pedido}: ${ESTADOS[SIG[p.estado]][0]}`); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo cambiar el estado.', e.message)); }
    });
  }
  async function cargar() {
    try {
      const data = await get(`/api/v1/orders${filtro ? `?estado=${filtro}` : ''}`);
      cuerpo.replaceChildren(data.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, `${data.length} pedidos`),
        h('thead', {}, h('tr', {}, ['N°', 'Fecha', 'Cliente', 'Productos', 'Total', 'Estado', 'Acción'].map((t, k) => h('th', { scope: 'col', class: k === 4 ? 'num' : '' }, t)))),
        h('tbody', {}, data.map((p) => {
          const b = SIG[p.estado] ? h('button', { type: 'button', class: 'btn small' }, `Pasar a ${ESTADOS[SIG[p.estado]][0].toLowerCase()}`) : null;
          if (b) b.addEventListener('click', () => avanzar(p, b));
          return h('tr', {}, h('td', {}, p.id_pedido), h('td', {}, fecha(p.fecha)), h('td', {}, p.cliente.nombre),
            h('td', {}, p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')), h('td', { class: 'num' }, clp(p.total)), h('td', {}, estadoTag(p.estado)), h('td', {}, b || h('span', { class: 'muted' }, 'Sin acciones')));
        })))) : vacio('No hay pedidos con ese estado.'));
    } catch (e) { cuerpo.replaceChildren(alerta('error', 'No pudimos cargar los pedidos.', e.message)); }
  }
  root.append(h('h1', {}, 'Administración'), pestanas('pedidos'), sel, av, cuerpo);
  cuerpo.append(skeletons(2));
  await cargar();
  const t = setInterval(cargar, 15000);
  nav.limpiar(() => clearInterval(t));
}

// ------------------------------------------------------------------ Insumos (RF11, RF13, RF14)
export async function adminInsumos(root) {
  const av = aviso();
  const cuerpo = h('div', { 'aria-live': 'polite' });
  const panel = h('section', { class: 'panel', 'aria-label': 'Formulario de insumo' });
  let editando = null;

  function formulario(i) {
    editando = i;
    const form = h('form', { class: 'form wide', novalidate: true },
      h('h2', {}, i ? `Editar ${i.nombre}` : 'Registrar insumo'),
      h('div', { class: 'grid2' },
        campo({ id: 'nombre', label: 'Nombre', required: true, value: i ? i.nombre : '', maxlength: 100 }),
        campo({ id: 'unidad_medida', label: 'Unidad de medida', options: [['g', 'Gramos'], ['ml', 'Mililitros'], ['unidad', 'Unidades']], value: i ? i.unidad_medida : 'g' }),
        campo({ id: 'stock_actual', label: 'Stock actual', type: 'number', required: true, min: 0, step: 'any', value: i ? i.stock_actual : '' }),
        campo({ id: 'stock_minimo', label: 'Stock mínimo', type: 'number', required: true, min: 0, step: 'any', value: i ? i.stock_minimo : '', hint: 'Al llegar a este nivel el insumo se marca como crítico.' })),
      h('fieldset', {}, h('legend', {}, 'Marcas para el filtro de alérgenos'),
        [['contiene_gluten', 'Contiene gluten'], ['contiene_lactosa', 'Contiene lactosa'], ['es_origen_animal', 'Es de origen animal']].map(([k, t]) => h('div', { class: 'field' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', name: k, checked: i ? i[k] : false }), t)))));
    const faf = aviso();
    const btn = h('button', { type: 'submit', class: 'btn' }, i ? 'Guardar cambios' : 'Registrar insumo');
    form.append(faf, h('p', {}, btn, ' ', i ? h('button', { type: 'button', class: 'btn secondary', onclick: () => formulario(null) }, 'Cancelar edición') : null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        const body = { nombre: form.nombre.value, unidad_medida: form.unidad_medida.value, stock_actual: form.stock_actual.value === '' ? null : Number(form.stock_actual.value), stock_minimo: form.stock_minimo.value === '' ? null : Number(form.stock_minimo.value),
          contiene_gluten: form.contiene_gluten.checked, contiene_lactosa: form.contiene_lactosa.checked, es_origen_animal: form.es_origen_animal.checked };
        try {
          if (i) await put(`/api/v1/supplies/${i.id_insumo}`, body); else await post('/api/v1/supplies', body);
          toast(i ? 'Insumo actualizado' : 'Insumo registrado');
          formulario(null); await cargar();
        } catch (err) { mostrarErrores(form, err, faf); }
      });
    });
    panel.replaceChildren(form);
  }

  async function cargar() {
    try {
      const data = await get('/api/v1/supplies');
      const criticos = data.filter((x) => x.critico).length;
      cuerpo.replaceChildren(
        criticos ? alerta('error', `${criticos} ${criticos === 1 ? 'insumo está' : 'insumos están'} en stock crítico.`, 'Reabastezca los marcados.') : alerta('success', 'Todo el inventario está sobre su mínimo.', ''),
        h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Inventario de insumos'),
          h('thead', {}, h('tr', {}, ['Insumo', 'Stock actual', 'Reservado', 'Mínimo', 'Estado', 'Acciones'].map((t, k) => h('th', { scope: 'col', class: k > 0 && k < 4 ? 'num' : '' }, t)))),
          h('tbody', {}, data.map((i) => {
            const cant = h('input', { type: 'number', min: '1', step: 'any', 'aria-label': `Cantidad a reabastecer de ${i.nombre}`, value: '' });
            const rb = h('button', { type: 'button', class: 'btn small' }, 'Reabastecer');
            rb.addEventListener('click', () => ocupado(rb, 'Guardando…', async () => {
              try { await patch(`/api/v1/supplies/${i.id_insumo}/restock`, { cantidad: Number(cant.value) }); toast(`${i.nombre} reabastecido`); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo reabastecer.', e.message)); cant.focus(); }
            }));
            const ed = h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Editar ${i.nombre}`, onclick: () => { formulario(i); panel.scrollIntoView(); panel.querySelector('input').focus(); } }, 'Editar');
            const el = h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Eliminar ${i.nombre}` }, 'Eliminar');
            el.addEventListener('click', async () => {
              if (!confirm(`¿Eliminar el insumo ${i.nombre}? Esta acción no se puede deshacer.`)) return;
              try { await del(`/api/v1/supplies/${i.id_insumo}`); toast('Insumo eliminado'); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo eliminar.', e.message)); }
            });
            return h('tr', {}, h('td', {}, i.nombre), h('td', { class: 'num' }, `${num(i.stock_actual)} ${i.unidad_medida}`), h('td', { class: 'num' }, num(i.stock_reservado)), h('td', { class: 'num' }, num(i.stock_minimo)),
              h('td', {}, i.critico ? h('span', { class: 'status bad' }, 'Crítico') : h('span', { class: 'status ok' }, 'Normal')),
              h('td', {}, h('div', { class: 'row-actions' }, cant, rb, ed, el)));
          })))));
    } catch (e) { cuerpo.replaceChildren(alerta('error', 'No pudimos cargar el inventario.', e.message)); }
  }
  root.append(h('h1', {}, 'Administración'), pestanas('insumos'), av, cuerpo, panel);
  cuerpo.append(skeletons(2));
  formulario(null);
  await cargar();
}

// ------------------------------------------------------------------ Menú y recetas (RF12, RF15)
export async function adminMenu(root) {
  const av = aviso();
  const cuerpo = h('div', { 'aria-live': 'polite' });
  const panel = h('section', { class: 'panel', 'aria-label': 'Formulario de producto' });
  const recetaBox = h('section', { class: 'panel', 'aria-label': 'Receta', hidden: true });
  let insumos = [];

  function formulario(p) {
    const form = h('form', { class: 'form wide', novalidate: true },
      h('h2', {}, p ? `Editar ${p.nombre}` : 'Agregar producto al menú'),
      h('div', { class: 'grid2' },
        campo({ id: 'nombre', label: 'Nombre', required: true, value: p ? p.nombre : '', maxlength: 100 }),
        campo({ id: 'precio', label: 'Precio (CLP)', type: 'number', required: true, min: 1, step: 1, value: p ? p.precio : '' }),
        campo({ id: 'categoria', label: 'Categoría', options: [['Café', 'Café'], ['Té', 'Té'], ['Galleta', 'Galleta']], value: p ? p.categoria : 'Café' }),
        campo({ id: 'tipo_preparacion', label: 'Preparación', options: [['caliente', 'Caliente'], ['frio', 'Frío'], ['no_aplica', 'No aplica']], value: p ? p.tipo_preparacion : 'caliente' })),
      campo({ id: 'descripcion', label: 'Descripción', required: true, value: p ? p.descripcion : '', maxlength: 255 }),
      h('div', { class: 'field' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'disponible', checked: p ? p.disponible : true }), 'Visible en el menú')));
    const faf = aviso();
    const btn = h('button', { type: 'submit', class: 'btn' }, p ? 'Guardar cambios' : 'Agregar producto');
    form.append(faf, h('p', {}, btn, ' ', p ? h('button', { type: 'button', class: 'btn secondary', onclick: () => formulario(null) }, 'Cancelar edición') : null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        const body = { nombre: form.nombre.value, descripcion: form.descripcion.value, precio: form.precio.value === '' ? null : Number(form.precio.value), categoria: form.categoria.value, tipo_preparacion: form.tipo_preparacion.value, disponible: form.disponible.checked };
        try {
          if (p) await put(`/api/v1/products/${p.id_producto}`, body); else await post('/api/v1/products', body);
          toast(p ? 'Producto actualizado' : 'Producto agregado');
          formulario(null); await cargar();
        } catch (err) { mostrarErrores(form, err, faf); }
      });
    });
    panel.replaceChildren(form);
  }

  async function receta(id) {
    const p = await get(`/api/v1/products/${id}`);
    const faf = aviso();
    const form = h('form', { class: 'form', novalidate: true },
      campo({ id: 'id_insumo', label: 'Insumo', options: insumos.map((i) => [i.id_insumo, `${i.nombre} (${i.unidad_medida})`]) }),
      campo({ id: 'cantidad_requerida', label: 'Cantidad por unidad vendida', type: 'number', required: true, min: 0, step: 'any' }), faf);
    const btn = h('button', { type: 'submit', class: 'btn' }, 'Agregar o actualizar');
    form.append(h('p', {}, btn));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        try { await post(`/api/v1/products/${id}/recipe`, { id_insumo: Number(form.id_insumo.value), cantidad_requerida: Number(form.cantidad_requerida.value) }); toast('Receta actualizada'); await receta(id); await cargar(); } catch (err) { mostrarErrores(form, err, faf); }
      });
    });
    recetaBox.hidden = false;
    recetaBox.replaceChildren(h('h2', {}, `Receta de ${p.nombre}`),
      p.receta.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Insumos que se descuentan por cada unidad vendida'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Insumo'), h('th', { scope: 'col', class: 'num' }, 'Cantidad'), h('th', { scope: 'col' }, 'Acción'))),
        h('tbody', {}, p.receta.map((r) => h('tr', {}, h('td', {}, r.nombre), h('td', { class: 'num' }, `${num(r.cantidad_requerida)} ${r.unidad_medida}`),
          h('td', {}, h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Quitar ${r.nombre} de la receta`, onclick: async () => {
            try { await del(`/api/v1/products/${id}/recipe/${r.id_insumo}`); toast('Insumo quitado'); await receta(id); await cargar(); } catch (err) { faf.replaceChildren(alerta('error', 'No se pudo quitar.', err.message)); }
          } }, 'Quitar'))))))) : alerta('info', 'Este producto no tiene receta.', 'Sin receta no se puede vender: agregue al menos un insumo.'),
      h('h3', {}, 'Agregar insumo'), form);
    recetaBox.scrollIntoView();
  }

  async function cargar() {
    try {
      const data = await get('/api/v1/products?available=false');
      cuerpo.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Productos del menú'),
        h('thead', {}, h('tr', {}, ['Producto', 'Categoría', 'Precio', 'En menú', 'A la venta', 'Acciones'].map((t, k) => h('th', { scope: 'col', class: k === 2 ? 'num' : '' }, t)))),
        h('tbody', {}, data.map((p) => h('tr', {}, h('td', {}, p.nombre), h('td', {}, p.categoria), h('td', { class: 'num' }, clp(p.precio)),
          h('td', {}, p.disponible ? 'Sí' : 'No'),
          h('td', {}, p.disponible_efectivo ? h('span', { class: 'status ok' }, 'Disponible') : h('span', { class: 'status bad' }, p.disponible ? 'Sin stock o sin receta' : 'Oculto')),
          h('td', {}, h('div', { class: 'row-actions' },
            h('button', { type: 'button', class: 'btn small', 'aria-label': `Receta de ${p.nombre}`, onclick: () => receta(p.id_producto) }, 'Receta'),
            h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Editar ${p.nombre}`, onclick: () => { formulario(p); panel.scrollIntoView(); panel.querySelector('input').focus(); } }, 'Editar'),
            h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Eliminar ${p.nombre}`, onclick: async () => {
              if (!confirm(`¿Eliminar ${p.nombre}?`)) return;
              try { await del(`/api/v1/products/${p.id_producto}`); toast('Producto eliminado'); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo eliminar.', e.message)); }
            } }, 'Eliminar')))))))));
    } catch (e) { cuerpo.replaceChildren(alerta('error', 'No pudimos cargar el menú.', e.message)); }
  }
  root.append(h('h1', {}, 'Administración'), pestanas('menu'), av, cuerpo, recetaBox, panel);
  cuerpo.append(skeletons(2));
  insumos = await get('/api/v1/supplies').catch(() => []);
  formulario(null);
  await cargar();
}

// ------------------------------------------------------------------ Reportes y consultas (RF13, RF16)
const decil = (v, max) => `w${Math.round((v / max) * 10) * 10}`;

function verConsulta(c) {
  return h('details', {}, h('summary', {}, `Ver consulta ${String(c.n).padStart(2, '0')} (${c.tipo})`), h('pre', { class: 'code', tabindex: '0', 'aria-label': `Consulta ${c.n} en MongoDB` }, c.texto));
}

export async function adminReportes(root) {
  root.append(h('h1', {}, 'Administración'), pestanas('reportes'), skeletons(2));
  let consultas = [];
  try { consultas = await get('/api/v1/reports/queries'); } catch (e) { /* los reportes igual se muestran */ }
  const q = (n) => consultas.find((c) => c.n === n);

  // consulta 04: GROUP BY + JOIN
  const top = h('section', { class: 'panel', 'aria-labelledby': 'rep-top' }, h('h2', { id: 'rep-top' }, 'Productos más vendidos'), h('p', { class: 'muted' }, 'Agrupa las líneas de todos los pedidos por producto y las une con el catálogo.'));
  // consulta 05: JOIN + operador de comparación
  const crit = h('section', { class: 'panel', 'aria-labelledby': 'rep-crit' }, h('h2', { id: 'rep-crit' }, 'Insumos críticos y productos afectados'), h('p', { class: 'muted' }, 'Insumos con stock actual menor o igual a su mínimo y los productos que los usan en su receta.'));
  // consulta 03: filtros
  const filt = h('section', { class: 'panel', 'aria-labelledby': 'rep-filt' }, h('h2', { id: 'rep-filt' }, 'Productos por categoría y preparación'));
  const resFilt = h('div', { 'aria-live': 'polite' });
  const fForm = h('form', { class: 'filters', onsubmit: (e) => e.preventDefault() },
    campo({ id: 'q-cat', label: 'Categoría', options: [['Café', 'Café'], ['Té', 'Té'], ['Galleta', 'Galleta']] }),
    campo({ id: 'q-prep', label: 'Preparación', options: [['caliente', 'Caliente'], ['frio', 'Frío'], ['no_aplica', 'No aplica']] }));
  async function filtrar() {
    resFilt.replaceChildren(skeletons(1));
    try {
      const d = await get(`/api/v1/products?category=${encodeURIComponent(fForm['q-cat'].value)}&preparation=${fForm['q-prep'].value}&sort=precio`);
      resFilt.replaceChildren(d.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Disponibles, de menor a mayor precio'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col', class: 'num' }, 'Precio'))),
        h('tbody', {}, d.map((p) => h('tr', {}, h('td', {}, p.nombre), h('td', { class: 'num' }, clp(p.precio))))))) : vacio('Sin resultados para esa combinación.'));
    } catch (e) { resFilt.replaceChildren(alerta('error', 'No pudimos ejecutar la consulta.', e.message)); }
  }
  fForm.addEventListener('input', filtrar);
  filt.append(fForm, resFilt, q(3) ? verConsulta(q(3)) : null);

  try {
    const t = await get('/api/v1/reports/top-products');
    const max = Math.max(1, ...t.map((r) => r.unidades_vendidas));
    top.append(t.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Ranking por unidades vendidas'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col', class: 'num' }, 'Unidades'), h('th', { scope: 'col' }, 'Proporción'))),
      h('tbody', {}, t.map((r) => h('tr', {}, h('td', {}, r.nombre), h('td', { class: 'num' }, r.unidades_vendidas), h('td', {}, h('div', { class: `bar ${decil(r.unidades_vendidas, max)}`, 'aria-hidden': 'true' }, h('span', {})))))))) : vacio('Aún no hay ventas.'), q(4) ? verConsulta(q(4)) : null);
  } catch (e) { top.append(alerta('error', 'No pudimos cargar el reporte.', e.message)); }

  try {
    const c = await get('/api/v1/reports/critical-supplies');
    crit.append(c.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Insumos en nivel crítico'),
      h('thead', {}, h('tr', {}, ['Insumo', 'Stock actual', 'Stock mínimo', 'Producto afectado'].map((x, k) => h('th', { scope: 'col', class: k === 1 || k === 2 ? 'num' : '' }, x)))),
      h('tbody', {}, c.map((r) => h('tr', {}, h('td', {}, r.insumo), h('td', { class: 'num' }, num(r.stock_actual)), h('td', { class: 'num' }, num(r.stock_minimo)), h('td', {}, r.producto)))))) : alerta('success', 'Ningún insumo en nivel crítico.', ''), q(5) ? verConsulta(q(5)) : null);
  } catch (e) { crit.append(alerta('error', 'No pudimos cargar el reporte.', e.message)); }

  const catalogo = h('section', { class: 'panel', 'aria-labelledby': 'rep-cat' }, h('h2', { id: 'rep-cat' }, 'Catálogo de las 13 consultas'),
    h('p', { class: 'muted' }, 'Las mismas consultas de la primera entrega, ahora en el lenguaje de MongoDB.'), consultas.map((c) => verConsulta(c)));
  root.replaceChildren(h('h1', {}, 'Administración'), pestanas('reportes'), top, crit, filt, catalogo);
  filtrar();
}
