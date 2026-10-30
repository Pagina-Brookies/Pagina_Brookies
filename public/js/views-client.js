import { get, post, put, del, setSesion, getSesion, getCarrito, agregar, cambiar, quitar, vaciar, totalCarrito, ApiError } from './api.js';
import { h, clp, fecha, toast, alerta, mostrarErrores, campo, skeletons, vacio, ocupado, estadoTag, ESTADOS } from './ui.js';

const aviso = () => h('div', { class: 'aviso', 'aria-live': 'polite' });

// ------------------------------------------------------------------ Menú (RF04)
const CATEGORIAS = ['todas', 'Café', 'Té', 'Galleta'];
const APTO = { sin_gluten: 'Sin gluten', sin_lactosa: 'Sin lactosa', vegano: 'Vegano' };

export function menu(root, nav) {
  const f = { category: 'todas', name: '', suitable_for: '', preparation: '', sort: 'nombre', available: true };
  const lista = h('div', { 'aria-live': 'polite' });
  const cartBox = h('aside', { class: 'cart', 'aria-label': 'Carrito' });
  let temporizador;
  let pedido = 0; // evita que una respuesta lenta pise a una más reciente

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Categoría' });
  function pintarChips() {
    chips.replaceChildren(...CATEGORIAS.map((c) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(f.category === c),
      onclick: () => { f.category = c; pintarChips(); cargar(); },
    }, c === 'todas' ? 'Todas' : c)));
  }

  const filtros = h('form', { class: 'filters', role: 'search', 'aria-label': 'Filtrar productos', onsubmit: (e) => e.preventDefault() },
    campo({ id: 'f-name', label: 'Buscar por nombre', type: 'search', maxlength: 100, opcional: false }),
    campo({ id: 'f-apto', label: 'Apto para', options: [['', 'Cualquiera'], ...Object.entries(APTO)] }),
    campo({ id: 'f-prep', label: 'Preparación', options: [['', 'Cualquiera'], ['caliente', 'Caliente'], ['frio', 'Frío'], ['no_aplica', 'No aplica']] }),
    campo({ id: 'f-sort', label: 'Ordenar por', options: [['nombre', 'Nombre'], ['precio', 'Precio, de menor a mayor'], ['mas_vendido', 'Más vendido']] }),
    h('div', { class: 'field' }, h('label', { class: 'check', for: 'f-disp' }, h('input', { id: 'f-disp', type: 'checkbox', checked: true }), 'Solo disponibles')));

  filtros.addEventListener('input', (e) => {
    f.name = filtros.querySelector('#f-name').value.trim();
    f.suitable_for = filtros.querySelector('#f-apto').value;
    f.preparation = filtros.querySelector('#f-prep').value;
    f.sort = filtros.querySelector('#f-sort').value;
    f.available = filtros.querySelector('#f-disp').checked;
    clearTimeout(temporizador);
    temporizador = setTimeout(cargar, e.target.id === 'f-name' ? 300 : 0);
  });

  function tarjeta(p) {
    const agotado = !p.disponible_efectivo;
    const cant = { v: 1 };
    const out = h('output', { 'aria-live': 'polite' }, '1');
    const mas = (d) => { cant.v = Math.max(1, Math.min(50, cant.v + d)); out.textContent = String(cant.v); };
    return h('li', {},
      h('article', { class: `card${agotado ? ' agotado' : ''}`, 'aria-labelledby': `p-${p.id_producto}` },
        h('h3', { id: `p-${p.id_producto}` }, p.nombre),
        h('p', { class: 'muted small' }, p.descripcion || ''),
        h('div', { class: 'tags' },
          h('span', { class: 'tag' }, p.categoria),
          p.tipo_preparacion !== 'no_aplica' ? h('span', { class: 'tag' }, p.tipo_preparacion === 'frio' ? 'Frío' : 'Caliente') : null,
          p.apto_para.map((a) => h('span', { class: 'tag' }, APTO[a]))),
        h('p', { class: 'price' }, clp(p.precio)),
        h('div', { class: 'actions' },
          agotado ? h('span', { class: 'status bad' }, 'No disponible por ahora') : [
            h('div', { class: 'qty', role: 'group', 'aria-label': `Cantidad de ${p.nombre}` },
              h('button', { type: 'button', 'aria-label': 'Una menos', onclick: () => mas(-1) }, '−'), out,
              h('button', { type: 'button', 'aria-label': 'Una más', onclick: () => mas(1) }, '+')),
            h('button', { type: 'button', class: 'btn small', onclick: () => { agregar(p, cant.v); toast(`${cant.v} × ${p.nombre} en el carrito`); } }, 'Agregar'),
          ])));
  }

  async function cargar() {
    const mi = ++pedido;
    lista.replaceChildren(skeletons(6));
    const q = new URLSearchParams();
    q.set('category', f.category);
    q.set('available', String(f.available));
    for (const k of ['name', 'suitable_for', 'preparation']) if (f[k]) q.set(k, f[k]);
    if (f.sort !== 'nombre') q.set('sort', f.sort);
    try {
      const data = await get(`/api/v1/products?${q}`);
      if (mi !== pedido) return;
      lista.replaceChildren(
        h('p', { class: 'muted', role: 'status' }, `${data.length} ${data.length === 1 ? 'producto' : 'productos'}`),
        data.length ? h('ul', { class: 'cards' }, data.map(tarjeta))
          : vacio('Ningún producto coincide con esos filtros. Pruebe quitando alguno o desmarcando "Solo disponibles".'));
    } catch (e) {
      if (mi === pedido) lista.replaceChildren(alerta('error', 'No pudimos cargar el menú.', e.message));
    }
  }

  function pintarCarrito() {
    const c = getCarrito();
    cartBox.replaceChildren(h('h2', { id: 'cart-h' }, 'Tu carrito'));
    cartBox.setAttribute('aria-labelledby', 'cart-h');
    if (!c.length) { cartBox.append(h('p', { class: 'muted' }, 'Aún no agregas productos. Elige algo del menú.')); return; }
    cartBox.append(h('ul', { class: 'cart-list' }, c.map((l) => h('li', {},
      h('span', {}, `${l.cantidad} × ${l.nombre}`),
      h('span', {}, clp(l.precio * l.cantidad)),
      h('span', { class: 'qty', role: 'group', 'aria-label': `Cantidad de ${l.nombre}` },
        h('button', { type: 'button', 'aria-label': `Quitar una unidad de ${l.nombre}`, onclick: () => cambiar(l.id, -1) }, '−'),
        h('button', { type: 'button', 'aria-label': `Agregar una unidad de ${l.nombre}`, onclick: () => cambiar(l.id, 1) }, '+'),
        h('button', { type: 'button', class: 'btn danger small', onclick: () => quitar(l.id) }, 'Quitar'))))),
    h('div', { class: 'total' }, h('span', {}, 'Total'), h('span', {}, clp(totalCarrito()))),
    h('a', { class: 'btn', href: '#/carrito' }, 'Ir a pagar'));
  }
  const onCarrito = () => pintarCarrito();
  window.addEventListener('carrito', onCarrito);
  nav.limpiar(() => window.removeEventListener('carrito', onCarrito));

  root.append(h('h1', {}, 'Menú'),
    h('div', { class: 'hero' }, h('p', {}, 'Café de especialidad, tés y galletas hechas en el local. Elige, paga en línea y retira sin hacer fila.')),
    h('div', { class: 'layout' }, h('section', { 'aria-label': 'Productos' }, chips, filtros, lista), cartBox));
  pintarChips(); pintarCarrito(); cargar();
}

// ------------------------------------------------------------------ Carrito y pago (RF05, RF06)
export function carrito(root, nav) {
  const c = getCarrito();
  root.append(h('h1', {}, 'Tu pedido'));
  if (!getSesion() || getSesion().usuario.rol !== 'cliente') {
    root.append(alerta('info', 'Para pagar necesitas una cuenta de cliente.', ''),
      h('p', {}, h('a', { class: 'btn', href: '#/ingresar' }, 'Ingresar'), ' ', h('a', { class: 'btn secondary', href: '#/registro' }, 'Crear cuenta')));
  }
  if (!c.length) { root.append(vacio('El carrito está vacío.'), h('p', {}, h('a', { href: '#/' }, 'Volver al menú'))); return; }
  const av = aviso();
  const btn = h('button', { type: 'button', class: 'btn' }, 'Reservar y pasar al pago');
  btn.addEventListener('click', () => ocupado(btn, 'Reservando…', async () => {
    try {
      const r = await post('/api/v1/orders/reservations', { items: c.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })) });
      location.hash = `#/pago/${r.id_reserva}`;
    } catch (e) {
      if (e.status === 401 || e.status === 403) { location.hash = '#/ingresar'; return; }
      av.replaceChildren(alerta('error', 'No se pudo reservar.', e.message + '. Ajuste el carrito e intente de nuevo.'));
    }
  }));
  root.append(h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Productos del pedido'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Producto'), h('th', { scope: 'col', class: 'num' }, 'Cantidad'), h('th', { scope: 'col', class: 'num' }, 'Subtotal'), h('th', { scope: 'col' }, 'Acciones'))),
    h('tbody', {}, c.map((l) => h('tr', {}, h('td', {}, l.nombre), h('td', { class: 'num' }, l.cantidad), h('td', { class: 'num' }, clp(l.precio * l.cantidad)),
      h('td', {}, h('button', { type: 'button', class: 'btn danger small', onclick: () => { quitar(l.id); nav.recargar(); } }, `Quitar ${l.nombre}`))))))),
  h('div', { class: 'total' }, h('span', {}, 'Total'), h('span', {}, clp(totalCarrito()))),
  h('p', { class: 'muted' }, 'Al reservar, guardamos tu stock por 10 minutos mientras pagas.'),
  av, h('p', {}, btn, ' ', h('a', { class: 'btn secondary', href: '#/' }, 'Seguir comprando')));
}

export async function pago(root, nav, id) {
  root.append(h('h1', {}, 'Pago'));
  const c = getCarrito();
  // la reserva no se puede consultar aparte: se muestra el carrito con el que se creó y un cronómetro de 10 minutos
  const clave = `brookies.reserva.${id}`;
  let vence = Number(sessionStorage.getItem(clave));
  if (!vence) { vence = Date.now() + 10 * 60000; sessionStorage.setItem(clave, String(vence)); }
  const reloj = h('p', { class: 'timer', role: 'timer' });
  const av = aviso();
  const form = h('form', { class: 'form', novalidate: true, 'aria-label': 'Datos de la tarjeta' },
    campo({ id: 'numero_tarjeta', label: 'Número de tarjeta', required: true, inputmode: 'numeric', autocomplete: 'cc-number', maxlength: 23,
      hint: 'De 13 a 19 dígitos. Es un pago de prueba: una tarjeta que termina en 0002 se rechaza y cualquier otra se aprueba. El número no se guarda.' }),
    h('div', { class: 'grid2' },
      campo({ id: 'vence', label: 'Vencimiento', required: true, autocomplete: 'cc-exp', inputmode: 'numeric', maxlength: 5, hint: 'Formato MM/AA' }),
      campo({ id: 'cvv', label: 'Código de seguridad', required: true, autocomplete: 'cc-csc', inputmode: 'numeric', maxlength: 4 })),
    h('p', { class: 'total' }, h('span', {}, 'Total a pagar'), h('span', {}, clp(totalCarrito()))));
  const btn = h('button', { type: 'submit', class: 'btn' }, 'Pagar');
  const cancelar = h('button', { type: 'button', class: 'btn secondary' }, 'Cancelar y liberar la reserva');
  form.append(av, h('p', {}, btn, ' ', cancelar));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ocupado(btn, 'Procesando pago…', async () => {
      try {
        const p = await post(`/api/v1/orders/reservations/${id}/pay`, { numero_tarjeta: form.numero_tarjeta.value });
        sessionStorage.removeItem(clave);
        vaciar();
        location.hash = `#/pedido/${p.id_pedido}?nuevo=1`;
      } catch (err) {
        if (err.status === 409) { av.replaceChildren(alerta('error', 'La reserva ya no está activa.', `${err.message}. Vuelva al carrito y reserve de nuevo.`)); return; }
        mostrarErrores(form, err, av);
      }
    });
  });
  cancelar.addEventListener('click', async () => {
    try { await del(`/api/v1/orders/reservations/${id}`); } catch (err) { /* ya vencida: da lo mismo */ }
    sessionStorage.removeItem(clave);
    location.hash = '#/carrito';
  });

  const tick = () => {
    const s = Math.max(0, Math.round((vence - Date.now()) / 1000));
    reloj.textContent = `Tiempo para pagar: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (s === 0) {
      btn.disabled = true;
      av.replaceChildren(alerta('error', 'La reserva venció.', 'Se liberó el stock. Vuelva al carrito para reservar de nuevo.'));
      clearInterval(t);
    }
  };
  const t = setInterval(tick, 1000);
  nav.limpiar(() => clearInterval(t));
  tick();
  root.append(h('p', { class: 'muted' }, `${c.reduce((s, l) => s + l.cantidad, 0)} productos reservados.`), reloj, form);
}

// ------------------------------------------------------------------ Pedidos (RF07)
function pasos(estado) {
  const orden = ['recibido', 'en_preparacion', 'listo'];
  const i = orden.indexOf(estado);
  return h('ol', { class: 'steps', 'aria-label': 'Avance del pedido' }, orden.map((e, k) => h('li', { class: k < i || (k === i && e === 'listo') ? 'done' : k === i ? 'current' : '', 'aria-current': k === i ? 'step' : false },
    ESTADOS[e][0], h('span', { class: 'st' }, k < i || (k === i && e === 'listo') ? 'Completado' : k === i ? 'Ahora' : 'Pendiente'))));
}

export async function pedido(root, nav, id, query) {
  root.append(h('h1', {}, `Pedido N° ${id}`), skeletons(1));
  const cuerpo = h('div', { 'aria-live': 'polite' });
  async function cargar(primera) {
    try {
      const p = await get(`/api/v1/orders/${id}`);
      cuerpo.replaceChildren(
        query.get('nuevo') ? alerta('success', 'Pago aprobado.', 'Recibimos tu pedido y ya lo estamos preparando.') : null,
        pasos(p.estado),
        h('p', {}, 'Estado: ', estadoTag(p.estado), '  ', h('span', { class: 'muted' }, fecha(p.fecha))),
        h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Detalle'),
          h('thead', {}, h('tr', {}, ['Producto', 'Cantidad', 'Precio', 'Subtotal'].map((t, k) => h('th', { scope: 'col', class: k ? 'num' : '' }, t)))),
          h('tbody', {}, p.items.map((i) => h('tr', {}, h('td', {}, i.nombre), h('td', { class: 'num' }, i.cantidad), h('td', { class: 'num' }, clp(i.precio_unitario)), h('td', { class: 'num' }, clp(i.subtotal))))))),
        h('div', { class: 'total' }, h('span', {}, 'Total'), h('span', {}, clp(p.total))),
        p.pago ? h('p', { class: 'muted' }, `Pago ${p.pago.estado_pago} con ${p.pago.metodo_pago}.`) : null,
        h('p', {}, h('a', { class: 'btn secondary', href: '#/pedidos' }, 'Ver mis pedidos')));
      return p.estado;
    } catch (e) {
      cuerpo.replaceChildren(alerta('error', 'No pudimos cargar el pedido.', e.message));
      return 'listo';
    }
  }
  root.replaceChildren(h('h1', {}, `Pedido N° ${id}`), cuerpo);
  const estado = await cargar(true);
  if (estado !== 'listo') {
    const t = setInterval(async () => { if ((await cargar()) === 'listo') clearInterval(t); }, 10000); // se actualiza solo
    nav.limpiar(() => clearInterval(t));
  }
}

export async function pedidos(root) {
  root.append(h('h1', {}, 'Mis pedidos'), skeletons(3));
  try {
    const data = await get('/api/v1/orders/mine');
    root.replaceChildren(h('h1', {}, 'Mis pedidos'), data.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('caption', {}, 'Historial de pedidos'),
      h('thead', {}, h('tr', {}, ['N°', 'Fecha', 'Productos', 'Total', 'Estado', ''].map((t, k) => h('th', { scope: 'col', class: k === 3 ? 'num' : '' }, t)))),
      h('tbody', {}, data.map((p) => h('tr', {}, h('td', {}, p.id_pedido), h('td', {}, fecha(p.fecha)),
        h('td', {}, p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')), h('td', { class: 'num' }, clp(p.total)), h('td', {}, estadoTag(p.estado)),
        h('td', {}, h('a', { href: `#/pedido/${p.id_pedido}`, 'aria-label': `Ver pedido ${p.id_pedido}` }, 'Ver'))))))) : vacio('Todavía no has hecho pedidos.'));
  } catch (e) { root.append(alerta('error', 'No pudimos cargar tus pedidos.', e.message)); }
}

// ------------------------------------------------------------------ Cuenta (RF01, RF02, RF03)
const REGLAS = [['8 caracteres como mínimo', (v) => v.length >= 8], ['Al menos un número', (v) => /\d/.test(v)]];

function reglasPassword(input) {
  const ul = h('ul', { class: 'rules', id: 'pw-reglas' }, REGLAS.map(([t]) => h('li', {}, t)));
  const act = () => [...ul.children].forEach((li, i) => {
    const ok = REGLAS[i][1](input.value);
    li.className = ok ? 'ok' : '';
    li.textContent = `${ok ? '✓ ' : ''}${REGLAS[i][0]}${ok ? ' (cumple)' : ''}`;
  });
  input.addEventListener('input', act);
  return ul;
}

function entrar(data, nav) {
  setSesion(data);
  const vuelta = sessionStorage.getItem('brookies.vuelta');
  sessionStorage.removeItem('brookies.vuelta');
  location.hash = vuelta || (data.usuario.rol === 'administrador' ? '#/admin/pedidos' : '#/');
}

export function ingresar(root, nav) {
  const av = aviso();
  const form = h('form', { class: 'form', novalidate: true },
    campo({ id: 'correo', label: 'Correo', type: 'email', required: true, autocomplete: 'username' }),
    campo({ id: 'contrasena', label: 'Contraseña', type: 'password', required: true, autocomplete: 'current-password' }), av);
  const btn = h('button', { type: 'submit', class: 'btn' }, 'Ingresar');
  form.append(h('p', {}, btn), h('p', { class: 'muted' }, '¿No tienes cuenta? ', h('a', { href: '#/registro' }, 'Crear una cuenta')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ocupado(btn, 'Ingresando…', async () => {
      try { entrar(await post('/api/v1/auth/login', { correo: form.correo.value, contrasena: form.contrasena.value }), nav); } catch (err) { mostrarErrores(form, err, av); }
    });
  });
  root.append(h('h1', {}, 'Ingresar'), form);
}

export function registro(root, nav) {
  const av = aviso();
  const pw = campo({ id: 'contrasena', label: 'Contraseña', type: 'password', required: true, autocomplete: 'new-password', hint: 'Debe cumplir estas reglas:' });
  const form = h('form', { class: 'form', novalidate: true },
    campo({ id: 'nombre', label: 'Nombre completo', required: true, autocomplete: 'name', maxlength: 100 }),
    campo({ id: 'correo', label: 'Correo', type: 'email', required: true, autocomplete: 'email', hint: 'Lo usarás para ingresar.' }), pw,
    campo({ id: 'telefono', label: 'Teléfono', type: 'tel', autocomplete: 'tel', maxlength: 20 }),
    campo({ id: 'direccion', label: 'Dirección', autocomplete: 'street-address', maxlength: 200 }), av);
  pw.append(reglasPassword(pw.querySelector('input')));
  pw.querySelector('input').setAttribute('aria-describedby', 'contrasena-hint pw-reglas');
  const btn = h('button', { type: 'submit', class: 'btn' }, 'Crear cuenta');
  form.append(h('p', {}, btn), h('p', { class: 'muted' }, '¿Ya tienes cuenta? ', h('a', { href: '#/ingresar' }, 'Ingresar')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ocupado(btn, 'Creando cuenta…', async () => {
      try {
        entrar(await post('/api/v1/auth/register', Object.fromEntries(['nombre', 'correo', 'contrasena', 'telefono', 'direccion'].map((k) => [k, form[k].value]))), nav);
      } catch (err) { mostrarErrores(form, err, av); }
    });
  });
  root.append(h('h1', {}, 'Crear cuenta'), form);
}

export async function perfil(root) {
  root.append(h('h1', {}, 'Mi perfil'), skeletons(1));
  try {
    const u = await get('/api/v1/users/me');
    const av = aviso();
    const form = h('form', { class: 'form', novalidate: true },
      campo({ id: 'nombre', label: 'Nombre completo', required: true, value: u.nombre, maxlength: 100 }),
      h('div', { class: 'field' }, h('p', { class: 'small muted' }, `Correo: ${u.correo}. No se puede cambiar.`)),
      campo({ id: 'telefono', label: 'Teléfono', type: 'tel', value: u.telefono || '', maxlength: 20 }),
      campo({ id: 'direccion', label: 'Dirección', value: u.direccion || '', maxlength: 200 }), av);
    const btn = h('button', { type: 'submit', class: 'btn' }, 'Guardar cambios');
    form.append(h('p', {}, btn));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(btn, 'Guardando…', async () => {
        try {
          const nuevo = await put('/api/v1/users/me', { nombre: form.nombre.value, telefono: form.telefono.value, direccion: form.direccion.value });
          setSesion({ ...getSesion(), usuario: nuevo });
          av.replaceChildren(alerta('success', 'Cambios guardados.', ''));
        } catch (err) { mostrarErrores(form, err, av); }
      });
    });
    root.replaceChildren(h('h1', {}, 'Mi perfil'), u.rol === 'cliente' ? form : alerta('info', 'La cuenta de administrador no tiene datos de perfil editables.', ''));
  } catch (e) { root.append(alerta('error', 'No pudimos cargar tu perfil.', e.message)); }
}

// ------------------------------------------------------------------ Local (RF17)
export async function local(root) {
  root.append(h('h1', {}, 'El local'), skeletons(1));
  try {
    const l = await get('/api/v1/local');
    root.replaceChildren(h('h1', {}, 'El local'),
      h('div', { class: 'panel' }, h('h2', {}, 'Dónde estamos'), h('p', {}, l.direccion)),
      h('div', { class: 'panel' }, h('h2', {}, 'Horarios'), h('ul', {}, l.horarios.map((x) => h('li', {}, h('strong', {}, `${x.dias}: `), x.horario)))),
      h('div', { class: 'panel' }, h('h2', {}, 'Contacto y ayuda'), h('p', {}, 'Teléfono: ', h('a', { href: `tel:${l.telefono.replace(/\s/g, '')}` }, l.telefono)), h('p', {}, 'Correo: ', h('a', { href: `mailto:${l.correo_contacto}` }, l.correo_contacto))));
  } catch (e) { root.append(alerta('error', 'No pudimos cargar los datos del local.', e.message)); }
}
