import { get, post, put, patch, del, getSesion } from './api.js';
import {
  h, clp, fecha, num, toast, alerta, mostrarErrores, campo, skeletons, vacio, ocupado, estadoTag, ESTADOS, modal, conUnidad, cambiarUnidad, UNIDAD, descargar,
} from './ui.js';

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
const UNIDADES = [['g', 'Gramos'], ['ml', 'Mililitros'], ['unidad', 'Unidades']];

/** Encabezado de sección con la acción principal arriba a la derecha. */
const cabecera = (titulo, boton) => h('div', { class: 'section-head' }, h('h2', {}, titulo), boton);

export async function adminInsumos(root) {
  const av = aviso();
  const cuerpo = h('div', { 'aria-live': 'polite' });

  function formulario(i) {
    const unidad = i ? i.unidad_medida : 'g';
    const form = h('form', { class: 'form wide', novalidate: true },
      h('div', { class: 'grid2' },
        campo({ id: 'nombre', label: 'Nombre', required: true, value: i ? i.nombre : '', maxlength: 100 }),
        campo({ id: 'unidad_medida', label: 'Unidad de medida', options: UNIDADES, value: unidad }),
        campo({ id: 'stock_actual', label: 'Stock actual', type: 'number', required: true, min: 0, step: 'any', value: i ? i.stock_actual : '', unit: unidad }),
        campo({ id: 'stock_minimo', label: 'Stock mínimo', type: 'number', required: true, min: 0, step: 'any', value: i ? i.stock_minimo : '', unit: unidad, hint: 'Al llegar a este nivel el insumo se marca como crítico.' })),
      h('fieldset', {}, h('legend', {}, 'Marcas para el filtro de alérgenos'),
        [['contiene_gluten', 'Contiene gluten'], ['contiene_lactosa', 'Contiene lactosa'], ['es_origen_animal', 'Es de origen animal']].map(([k, t]) => h('div', { class: 'field' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', name: k, checked: i ? i[k] : false }), t)))));
    form.unidad_medida.addEventListener('change', () => cambiarUnidad(form, form.unidad_medida.value));
    const faf = aviso();
    const m = modal(i ? `Editar ${i.nombre}` : 'Registrar insumo');
    const btn = h('button', { type: 'submit', class: 'btn' }, i ? 'Guardar cambios' : 'Registrar insumo');
    form.append(faf, h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn secondary', onclick: m.cerrar }, 'Cancelar'), btn));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        const body = { nombre: form.nombre.value, unidad_medida: form.unidad_medida.value, stock_actual: form.stock_actual.value === '' ? null : Number(form.stock_actual.value), stock_minimo: form.stock_minimo.value === '' ? null : Number(form.stock_minimo.value),
          contiene_gluten: form.contiene_gluten.checked, contiene_lactosa: form.contiene_lactosa.checked, es_origen_animal: form.es_origen_animal.checked };
        try {
          if (i) await put(`/api/v1/supplies/${i.id_insumo}`, body); else await post('/api/v1/supplies', body);
          toast(i ? 'Insumo actualizado' : 'Insumo registrado');
          m.cerrar(); await cargar();
        } catch (err) { mostrarErrores(form, err, faf); }
      });
    });
    m.cuerpo.append(form);
    form.nombre.focus();
  }

  /** Lleva a la fila del insumo, la resalta y deja el foco en su botón Editar. */
  function irA(id) {
    const fila = cuerpo.querySelector(`#ins-${id}`);
    if (!fila) return;
    fila.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    fila.classList.remove('destacado');
    void fila.offsetWidth; // reinicia la animación si se aprieta dos veces
    fila.classList.add('destacado');
    fila.querySelector('.editar').focus({ preventScroll: true });
  }

  async function ajustar(i, cant, btn, signo) {
    const cantidad = Number(cant.value);
    if (!cant.value || !(cantidad > 0)) { av.replaceChildren(alerta('error', `Indique cuánto ${signo > 0 ? 'reabastecer' : 'restar'} de ${i.nombre}.`, `Debe ser un número mayor a 0, en ${UNIDAD[i.unidad_medida]}.`)); cant.focus(); return; }
    await ocupado(btn, 'Guardando…', async () => {
      try {
        await patch(`/api/v1/supplies/${i.id_insumo}/${signo > 0 ? 'restock' : 'withdraw'}`, { cantidad });
        toast(`${i.nombre}: ${signo > 0 ? '+' : '−'}${num(cantidad)} ${UNIDAD[i.unidad_medida]}`);
        av.replaceChildren();
        await cargar();
      } catch (e) { av.replaceChildren(alerta('error', signo > 0 ? 'No se pudo reabastecer.' : 'No se pudo restar.', e.message)); cant.focus(); }
    });
  }

  async function cargar() {
    try {
      const data = await get('/api/v1/supplies');
      const criticos = data.filter((x) => x.critico);
      cuerpo.replaceChildren(
        criticos.length
          ? h('div', { class: 'alert error', role: 'alert' },
            h('strong', {}, `${criticos.length} ${criticos.length === 1 ? 'insumo está' : 'insumos están'} en stock crítico:`), ' ',
            h('span', { class: 'link-list' }, criticos.map((x) => h('button', { type: 'button', class: 'link', onclick: () => irA(x.id_insumo) }, x.nombre))),
            h('span', { class: 'muted' }, ' Toque un nombre para ir a él.'))
          : alerta('success', 'Todo el inventario está sobre su mínimo.', ''),
        h('div', { class: 'table-wrap' }, h('table', {}, h('caption', { class: 'sr-only' }, 'Inventario de insumos'),
          h('thead', {}, h('tr', {}, ['Insumo', 'Stock actual', 'Reservado', 'Mínimo', 'Estado', 'Ajustar stock', 'Acciones'].map((t, k) => h('th', { scope: 'col', class: k > 0 && k < 4 ? 'num' : '' }, t)))),
          h('tbody', {}, data.map((i) => {
            const u = UNIDAD[i.unidad_medida];
            const cant = h('input', { type: 'number', min: '0.01', step: 'any', inputmode: 'decimal', 'aria-label': `Cantidad de ${i.nombre} en ${u}`, value: '' });
            const rb = h('button', { type: 'button', class: 'btn small', title: 'Suma la cantidad al stock' }, 'Reabastecer');
            const rs = h('button', { type: 'button', class: 'btn secondary small', title: 'Resta la cantidad, por ejemplo si se cargó de más' }, 'Restar');
            rb.addEventListener('click', () => ajustar(i, cant, rb, 1));
            rs.addEventListener('click', () => ajustar(i, cant, rs, -1));
            cant.addEventListener('keydown', (e) => { if (e.key === 'Enter') rb.click(); });
            const ed = h('button', { type: 'button', class: 'btn secondary small editar', 'aria-label': `Editar ${i.nombre}`, onclick: () => formulario(i) }, 'Editar');
            const el = h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Eliminar ${i.nombre}` }, 'Eliminar');
            el.addEventListener('click', async () => {
              if (!confirm(`¿Eliminar el insumo ${i.nombre}? Esta acción no se puede deshacer.`)) return;
              try { await del(`/api/v1/supplies/${i.id_insumo}`); toast('Insumo eliminado'); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo eliminar.', e.message)); }
            });
            return h('tr', { id: `ins-${i.id_insumo}`, class: i.critico ? 'fila-critica' : '' },
              h('th', { scope: 'row' }, i.nombre), h('td', { class: 'num' }, `${num(i.stock_actual)} ${u}`), h('td', { class: 'num' }, `${num(i.stock_reservado)} ${u}`), h('td', { class: 'num' }, `${num(i.stock_minimo)} ${u}`),
              h('td', {}, i.critico ? h('span', { class: 'status bad' }, 'Crítico') : h('span', { class: 'status ok' }, 'Normal')),
              h('td', {}, h('div', { class: 'row-actions' }, conUnidad(cant, i.unidad_medida), rb, rs)),
              h('td', {}, h('div', { class: 'row-actions' }, ed, el)));
          })))));
    } catch (e) { cuerpo.replaceChildren(alerta('error', 'No pudimos cargar el inventario.', e.message)); }
  }
  const nuevo = h('button', { type: 'button', class: 'btn', onclick: () => formulario(null) }, '+ Registrar insumo');
  root.append(h('h1', {}, 'Administración'), pestanas('insumos'), cabecera('Inventario de insumos', nuevo), av, cuerpo);
  cuerpo.append(skeletons(2));
  await cargar();
}

// ------------------------------------------------------------------ Menú y recetas (RF12, RF15)
const IMG_MAX = 1000; // lado mayor, en píxeles: de sobra para la tarjeta del menú y liviana de bajar

/** Achica la foto en el navegador antes de subirla (una foto de celular pesa varios MB). */
async function prepararImagen(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('El archivo debe ser una imagen JPEG, PNG o WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen pesa más de 15 MB. Elija una más liviana.');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const comoBlob = (tipo) => new Promise((ok) => canvas.toBlob(ok, tipo, 0.85));
  let blob = await comoBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await comoBlob('image/jpeg'); // navegadores sin WebP
  return blob;
}

export async function adminMenu(root) {
  const av = aviso();
  const cuerpo = h('div', { 'aria-live': 'polite' });
  let insumos = [];

  function formulario(p) {
    const esNuevo = !p;
    let nuevaImagen = null; // Blob listo para subir
    let quitarImagen = false;
    const form = h('form', { class: 'form-producto', novalidate: true });
    const datos = h('div', {},
      h('div', { class: 'grid2' },
        campo({ id: 'nombre', label: 'Nombre', required: true, value: p ? p.nombre : '', maxlength: 100 }),
        campo({ id: 'precio', label: 'Precio', type: 'number', required: true, min: 1, step: 1, value: p ? p.precio : '', unit: 'CLP' }),
        campo({ id: 'categoria', label: 'Categoría', options: [['Café', 'Café'], ['Té', 'Té'], ['Galleta', 'Galleta']], value: p ? p.categoria : 'Café' }),
        campo({ id: 'tipo_preparacion', label: 'Preparación', options: [['caliente', 'Caliente'], ['frio', 'Frío'], ['no_aplica', 'No aplica']], value: p ? p.tipo_preparacion : 'caliente' })),
      campo({ id: 'descripcion', label: 'Descripción', required: true, value: p ? p.descripcion : '', maxlength: 255 }),
      h('div', { class: 'field' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'disponible', checked: p ? p.disponible : true }), 'Mostrar en el menú'),
        h('p', { class: 'hint' }, 'Si lo desmarca, los clientes dejan de verlo. Si solo falta stock, déjelo marcado: aparecerá como agotado.')));

    // imagen: se elige aquí y se sube al guardar
    const vista = h('div', { class: 'img-preview' });
    const archivo = h('input', { type: 'file', id: 'imagen', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only' });
    const elegir = h('label', { for: 'imagen', class: 'btn secondary small' });
    const quitar = h('button', { type: 'button', class: 'btn danger small' }, 'Quitar imagen');
    const imgAviso = h('p', { class: 'hint', 'aria-live': 'polite' });
    function pintarImagen(src) {
      vista.replaceChildren(src ? h('img', { src, alt: 'Vista previa de la imagen del producto' }) : h('div', { class: 'sin-foto' }, h('img', { src: 'img/logo.svg', alt: '' }), h('span', {}, 'Sin imagen')));
      elegir.textContent = src ? 'Cambiar imagen' : 'Subir imagen';
      quitar.hidden = !src;
    }
    archivo.addEventListener('change', async () => {
      const file = archivo.files[0];
      if (!file) return;
      try {
        nuevaImagen = await prepararImagen(file);
        quitarImagen = false;
        pintarImagen(URL.createObjectURL(nuevaImagen));
        imgAviso.textContent = 'La imagen se guarda al apretar "Guardar".';
      } catch (e) { imgAviso.textContent = e.message; }
      archivo.value = '';
    });
    quitar.addEventListener('click', () => { nuevaImagen = null; quitarImagen = Boolean(p && p.imagen_url); pintarImagen(null); imgAviso.textContent = quitarImagen ? 'La imagen se quita al apretar "Guardar".' : ''; });
    pintarImagen(p ? p.imagen_url : null);
    const imagen = h('div', { class: 'img-box' }, h('p', { class: 'label' }, 'Imagen'), vista, h('div', { class: 'row-actions' }, archivo, elegir, quitar), imgAviso,
      h('p', { class: 'hint' }, 'JPEG, PNG o WebP. Se ajusta sola al tamaño del menú.'));

    const faf = aviso();
    const m = modal(p ? `Editar ${p.nombre}` : 'Agregar producto al menú', { ancho: 'ancho' });
    const btn = h('button', { type: 'submit', class: 'btn' }, p ? 'Guardar' : 'Agregar y definir receta');
    form.append(h('div', { class: 'producto-grid' }, datos, imagen), faf,
      h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn secondary', onclick: m.cerrar }, 'Cancelar'), btn));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        const body = { nombre: form.nombre.value, descripcion: form.descripcion.value, precio: form.precio.value === '' ? null : Number(form.precio.value), categoria: form.categoria.value, tipo_preparacion: form.tipo_preparacion.value, disponible: form.disponible.checked };
        let guardado;
        try {
          guardado = p ? await put(`/api/v1/products/${p.id_producto}`, body) : await post('/api/v1/products', body);
        } catch (err) { mostrarErrores(form, err, faf); return; }
        p = guardado; // si falla la imagen, el siguiente intento ya edita el producto creado
        try {
          if (nuevaImagen) await put(`/api/v1/products/${guardado.id_producto}/image`, nuevaImagen);
          else if (quitarImagen) await del(`/api/v1/products/${guardado.id_producto}/image`);
        } catch (err) { faf.replaceChildren(alerta('error', 'Los datos se guardaron, pero la imagen no.', err.message)); await cargar(); return; }
        toast(esNuevo ? 'Producto agregado' : 'Producto actualizado');
        m.cerrar();
        await cargar();
        if (esNuevo) receta(guardado.id_producto); // un producto nuevo no se vende sin receta: se abre de inmediato
      });
    });
    m.cuerpo.append(form);
    form.nombre.focus();
  }

  /** Receta en ventana emergente. Cada cambio se guarda al instante. */
  async function receta(id) {
    const m = modal('Receta', { ancho: 'ancho', alCerrar: () => cargar() });
    const contenido = h('div', { 'aria-live': 'polite' }, skeletons(1));
    m.cuerpo.append(contenido);
    const faf = aviso();

    async function pintar() {
      const p = await get(`/api/v1/products/${id}`);
      m.dlg.querySelector('h2').textContent = `Receta de ${p.nombre}`;
      const opciones = insumos.map((i) => [i.id_insumo, `${i.nombre} (${UNIDAD[i.unidad_medida]})`]);
      const form = h('form', { class: 'receta-form', novalidate: true },
        campo({ id: 'id_insumo', label: 'Insumo', options: opciones }),
        campo({ id: 'cantidad_requerida', label: 'Cantidad por unidad vendida', type: 'number', required: true, min: 0, step: 'any', unit: insumos.length ? insumos[0].unidad_medida : 'g' }));
      const unidadDe = (idIns) => (insumos.find((i) => i.id_insumo === Number(idIns)) || {}).unidad_medida;
      form.id_insumo.addEventListener('change', () => cambiarUnidad(form, unidadDe(form.id_insumo.value)));
      const btn = h('button', { type: 'submit', class: 'btn' }, 'Agregar o actualizar');
      form.append(h('div', { class: 'field' }, btn));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        ocupado(btn, 'Guardando…', async () => {
          try {
            await post(`/api/v1/products/${id}/recipe`, { id_insumo: Number(form.id_insumo.value), cantidad_requerida: Number(form.cantidad_requerida.value) });
            toast('Receta actualizada'); faf.replaceChildren(); await pintar();
          } catch (err) { mostrarErrores(form, err, faf); }
        });
      });
      contenido.replaceChildren(
        p.receta.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Insumos que se descuentan por cada unidad vendida'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Insumo'), h('th', { scope: 'col', class: 'num' }, 'Cantidad'), h('th', { scope: 'col' }, 'Acción'))),
          h('tbody', {}, p.receta.map((r) => h('tr', {}, h('td', {}, r.nombre), h('td', { class: 'num' }, `${num(r.cantidad_requerida)} ${UNIDAD[r.unidad_medida]}`),
            h('td', {}, h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Quitar ${r.nombre} de la receta`, onclick: async () => {
              try { await del(`/api/v1/products/${id}/recipe/${r.id_insumo}`); toast('Insumo quitado'); await pintar(); } catch (err) { faf.replaceChildren(alerta('error', 'No se pudo quitar.', err.message)); }
            } }, 'Quitar'))))))) : alerta('info', 'Este producto todavía no tiene receta.', 'Sin receta no se puede vender: agregue al menos un insumo.'),
        h('h3', {}, 'Agregar insumo'), form, faf,
        h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn secondary', onclick: m.cerrar }, 'Listo')));
      form.cantidad_requerida.focus();
    }
    try { await pintar(); } catch (e) { contenido.replaceChildren(alerta('error', 'No pudimos cargar la receta.', e.message)); }
  }

  async function cargar() {
    try {
      const data = await get('/api/v1/products?available=false');
      cuerpo.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {}, h('caption', { class: 'sr-only' }, 'Productos del menú'),
        h('thead', {}, h('tr', {}, ['', 'Producto', 'Categoría', 'Precio', 'En el menú', 'Acciones'].map((t, k) => h('th', { scope: 'col', class: k === 3 ? 'num' : '' }, t || h('span', { class: 'sr-only' }, 'Imagen'))))),
        h('tbody', {}, data.map((p) => h('tr', {},
          h('td', { class: 'thumb-cell' }, p.imagen_url ? h('img', { class: 'thumb', src: p.imagen_url, alt: '' }) : h('div', { class: 'thumb sin-foto', title: 'Sin imagen' }, h('img', { src: 'img/logo.svg', alt: '' }))),
          h('th', { scope: 'row' }, p.nombre), h('td', {}, p.categoria), h('td', { class: 'num' }, clp(p.precio)),
          h('td', {}, !p.disponible ? h('span', { class: 'status wait' }, 'Oculto') : p.disponible_efectivo ? h('span', { class: 'status ok' }, 'A la venta') : h('span', { class: 'status bad' }, 'Agotado o sin receta')),
          h('td', {}, h('div', { class: 'row-actions' },
            h('button', { type: 'button', class: 'btn small', 'aria-label': `Receta de ${p.nombre}`, onclick: () => receta(p.id_producto) }, 'Receta'),
            h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Editar ${p.nombre}`, onclick: () => formulario(p) }, 'Editar'),
            h('button', { type: 'button', class: 'btn danger small', 'aria-label': `Eliminar ${p.nombre}`, onclick: async () => {
              if (!confirm(`¿Eliminar ${p.nombre}?`)) return;
              try { await del(`/api/v1/products/${p.id_producto}`); toast('Producto eliminado'); await cargar(); } catch (e) { av.replaceChildren(alerta('error', 'No se pudo eliminar.', e.message)); }
            } }, 'Eliminar')))))))));
    } catch (e) { cuerpo.replaceChildren(alerta('error', 'No pudimos cargar el menú.', e.message)); }
  }
  const nuevo = h('button', { type: 'button', class: 'btn', onclick: () => formulario(null) }, '+ Agregar producto');
  root.append(h('h1', {}, 'Administración'), pestanas('menu'), cabecera('Productos del menú', nuevo), av, cuerpo);
  cuerpo.append(skeletons(2));
  insumos = await get('/api/v1/supplies').catch(() => []);
  await cargar();
}

// ------------------------------------------------------------------ Reportes y consultas (RF13, RF16)
const decil = (v, max) => `w${Math.round((v / max) * 10) * 10}`;

function verConsulta(c) {
  return h('details', {}, h('summary', {}, `Ver consulta ${String(c.n).padStart(2, '0')} (${c.tipo})`), h('pre', { class: 'code', tabindex: '0', 'aria-label': `Consulta ${c.n} en MongoDB` }, c.texto));
}

const escapar = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let plantilla = null;

/**
 * Descarga un reporte con la plantilla común (public/reportes/plantilla.html): es la misma para todos y
 * solo se reemplazan los marcadores {{...}} por los valores actuales. Todo texto va escapado.
 */
async function descargarReporte({ archivo, titulo, descripcion, columnas, filas, numericas = [], resumen = '' }) {
  if (!plantilla) {
    const res = await fetch('reportes/plantilla.html');
    if (!res.ok) throw new Error('No se encontró la plantilla de reportes.');
    plantilla = await res.text();
  }
  const ahora = new Date();
  const celda = (v, k, tag) => `<${tag}${numericas.includes(k) ? ' class="num"' : ''}>${escapar(v)}</${tag}>`;
  const tabla = filas.length
    ? `<table><thead><tr>${columnas.map((c, k) => celda(c, k, 'th')).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((v, k) => celda(v, k, 'td')).join('')}</tr>`).join('')}</tbody></table>`
    : '<p class="vacio">Sin datos para este reporte en este momento.</p>';
  const valores = {
    titulo: escapar(titulo),
    descripcion: escapar(descripcion),
    fecha: escapar(fecha(ahora)),
    usuario: escapar((getSesion() || { usuario: { nombre: '' } }).usuario.nombre),
    total_filas: escapar(filas.length),
    resumen: escapar(resumen),
    tabla,
  };
  const html = plantilla.replace(/\{\{(\w+)\}\}/g, (todo, k) => (k in valores ? valores[k] : ''));
  descargar(`${archivo}-${ahora.toISOString().slice(0, 10)}.html`, html, 'text/html;charset=utf-8');
}

function botonDescarga(armar) {
  const b = h('button', { type: 'button', class: 'btn secondary small' }, '⤓ Descargar');
  b.addEventListener('click', () => ocupado(b, 'Preparando…', async () => {
    try { await descargarReporte(armar()); } catch (e) { toast(e.message); }
  }));
  return b;
}

export async function adminReportes(root) {
  root.append(h('h1', {}, 'Administración'), pestanas('reportes'), skeletons(2));
  let consultas = [];
  try { consultas = await get('/api/v1/reports/queries'); } catch (e) { /* los reportes igual se muestran */ }
  const q = (n) => consultas.find((c) => c.n === n);
  let topData = [];
  let critData = [];
  let filtData = [];

  const encabezado = (id, titulo, armar) => h('div', { class: 'section-head' }, h('h2', { id }, titulo), botonDescarga(armar));

  // consulta 04: GROUP BY + JOIN
  const DESC_TOP = 'Agrupa las líneas de todos los pedidos por producto y las une con el catálogo.';
  const top = h('section', { class: 'panel', 'aria-labelledby': 'rep-top' },
    encabezado('rep-top', 'Productos más vendidos', () => ({
      archivo: 'productos-mas-vendidos', titulo: 'Productos más vendidos', descripcion: DESC_TOP,
      columnas: ['N°', 'Producto', 'Unidades vendidas'], numericas: [0, 2],
      filas: topData.map((r, k) => [k + 1, r.nombre, r.unidades_vendidas]),
      resumen: `${topData.reduce((s, r) => s + r.unidades_vendidas, 0)} unidades vendidas en total.`,
    })),
    h('p', { class: 'muted' }, DESC_TOP));
  // consulta 05: JOIN + operador de comparación
  const DESC_CRIT = 'Insumos con stock actual menor o igual a su mínimo y los productos que los usan en su receta.';
  const crit = h('section', { class: 'panel', 'aria-labelledby': 'rep-crit' },
    encabezado('rep-crit', 'Insumos críticos y productos afectados', () => ({
      archivo: 'insumos-criticos', titulo: 'Insumos críticos y productos afectados', descripcion: DESC_CRIT,
      columnas: ['Insumo', 'Stock actual', 'Stock mínimo', 'Producto afectado'], numericas: [1, 2],
      filas: critData.map((r) => [r.insumo, num(r.stock_actual), num(r.stock_minimo), r.producto]),
      resumen: `${new Set(critData.map((r) => r.insumo)).size} insumos en nivel crítico.`,
    })),
    h('p', { class: 'muted' }, DESC_CRIT));
  // consulta 03: filtros
  const resFilt = h('div', { 'aria-live': 'polite' });
  const fForm = h('form', { class: 'filters', onsubmit: (e) => e.preventDefault() },
    campo({ id: 'q-cat', label: 'Categoría', options: [['Café', 'Café'], ['Té', 'Té'], ['Galleta', 'Galleta']] }),
    campo({ id: 'q-prep', label: 'Preparación', options: [['caliente', 'Caliente'], ['frio', 'Frío'], ['no_aplica', 'No aplica']] }));
  const prepTexto = () => fForm['q-prep'].selectedOptions[0].textContent;
  const filt = h('section', { class: 'panel', 'aria-labelledby': 'rep-filt' },
    encabezado('rep-filt', 'Productos por categoría y preparación', () => ({
      archivo: 'productos-por-categoria', titulo: 'Productos por categoría y preparación',
      descripcion: `Productos disponibles de la categoría ${fForm['q-cat'].value}, preparación ${prepTexto().toLowerCase()}, de menor a mayor precio.`,
      columnas: ['Producto', 'Precio'], numericas: [1],
      filas: filtData.map((p) => [p.nombre, clp(p.precio)]),
      resumen: `${filtData.length} productos encontrados.`,
    })));
  async function filtrar() {
    resFilt.replaceChildren(skeletons(1));
    try {
      filtData = await get(`/api/v1/products?category=${encodeURIComponent(fForm['q-cat'].value)}&preparation=${fForm['q-prep'].value}&sort=precio`);
      resFilt.replaceChildren(filtData.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Disponibles, de menor a mayor precio'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col', class: 'num' }, 'Precio'))),
        h('tbody', {}, filtData.map((p) => h('tr', {}, h('td', {}, p.nombre), h('td', { class: 'num' }, clp(p.precio))))))) : vacio('Sin resultados para esa combinación.'));
    } catch (e) { filtData = []; resFilt.replaceChildren(alerta('error', 'No pudimos ejecutar la consulta.', e.message)); }
  }
  fForm.addEventListener('input', filtrar);
  filt.append(fForm, resFilt, q(3) ? verConsulta(q(3)) : null);

  try {
    topData = await get('/api/v1/reports/top-products');
    const max = Math.max(1, ...topData.map((r) => r.unidades_vendidas));
    top.append(topData.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Ranking por unidades vendidas'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col', class: 'num' }, 'Unidades'), h('th', { scope: 'col' }, 'Proporción'))),
      h('tbody', {}, topData.map((r) => h('tr', {}, h('td', {}, r.nombre), h('td', { class: 'num' }, r.unidades_vendidas), h('td', {}, h('div', { class: `bar ${decil(r.unidades_vendidas, max)}`, 'aria-hidden': 'true' }, h('span', {})))))))) : vacio('Aún no hay ventas.'), q(4) ? verConsulta(q(4)) : null);
  } catch (e) { top.append(alerta('error', 'No pudimos cargar el reporte.', e.message)); }

  try {
    critData = await get('/api/v1/reports/critical-supplies');
    crit.append(critData.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Insumos en nivel crítico'),
      h('thead', {}, h('tr', {}, ['Insumo', 'Stock actual', 'Stock mínimo', 'Producto afectado'].map((x, k) => h('th', { scope: 'col', class: k === 1 || k === 2 ? 'num' : '' }, x)))),
      h('tbody', {}, critData.map((r) => h('tr', {}, h('td', {}, r.insumo), h('td', { class: 'num' }, num(r.stock_actual)), h('td', { class: 'num' }, num(r.stock_minimo)), h('td', {}, r.producto)))))) : alerta('success', 'Ningún insumo en nivel crítico.', ''), q(5) ? verConsulta(q(5)) : null);
  } catch (e) { crit.append(alerta('error', 'No pudimos cargar el reporte.', e.message)); }

  const catalogo = h('section', { class: 'panel', 'aria-labelledby': 'rep-cat' }, h('h2', { id: 'rep-cat' }, 'Catálogo de las 13 consultas'),
    h('p', { class: 'muted' }, 'Las mismas consultas de la primera entrega, ahora en el lenguaje de MongoDB.'), consultas.map((c) => verConsulta(c)));
  root.replaceChildren(h('h1', {}, 'Administración'), pestanas('reportes'),
    h('p', { class: 'muted' }, 'Cada reporte se descarga con la misma plantilla y los valores de este momento. Ábralo en el navegador; para PDF use Imprimir → Guardar como PDF.'),
    top, crit, filt, catalogo);
  filtrar();
}
