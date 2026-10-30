import { getSesion, esAdmin, esCliente, setSesion, cantidadTotal } from './api.js';
import { h } from './ui.js';
import * as C from './views-client.js';
import * as A from './views-admin.js';

const root = document.getElementById('main');
const navEl = document.getElementById('nav');
let limpiezas = [];
const nav = {
  limpiar: (fn) => limpiezas.push(fn),
  recargar: () => render(),
};

// [patrón, función, título, acceso]  acceso: null = público, 'cliente', 'admin', 'sesion'
const RUTAS = [
  [/^\/$/, (r, n) => C.menu(r, n), 'Menú', null],
  [/^\/carrito$/, (r, n) => C.carrito(r, n), 'Tu pedido', null],
  [/^\/pedido\/(\d+)$/, (r, n, m, q) => C.pedido(r, n, m[1], q), 'Pedido', 'sesion'],
  [/^\/pedidos$/, (r) => C.pedidos(r), 'Mis pedidos', 'cliente'],
  [/^\/perfil$/, (r) => C.perfil(r), 'Mi perfil', 'sesion'],
  [/^\/ingresar$/, (r, n) => C.ingresar(r, n), 'Ingresar', null],
  [/^\/registro$/, (r, n) => C.registro(r, n), 'Crear cuenta', null],
  [/^\/local$/, (r) => C.local(r), 'El local', null],
  [/^\/admin\/pedidos$/, (r, n) => A.adminPedidos(r, n), 'Administración: pedidos', 'admin'],
  [/^\/admin\/insumos$/, (r) => A.adminInsumos(r), 'Administración: insumos', 'admin'],
  [/^\/admin\/menu$/, (r) => A.adminMenu(r), 'Administración: menú', 'admin'],
  [/^\/admin\/reportes$/, (r) => A.adminReportes(r), 'Administración: reportes', 'admin'],
];

function pintarNav() {
  const actual = location.hash.slice(1).split('?')[0] || '/';
  const link = (href, texto, extra) => h('a', { href: `#${href}`, 'aria-current': actual === href ? 'page' : false }, texto, extra);
  const items = [link('/', 'Menú'), link('/local', 'El local')];
  if (esAdmin()) items.push(link('/admin/pedidos', 'Administración'));
  else {
    const n = cantidadTotal();
    items.push(link('/carrito', 'Carrito', n ? h('span', { class: 'badge', 'aria-label': `${n} productos` }, n) : null));
  }
  items.push(h('span', { class: 'sep', 'aria-hidden': 'true' }));
  const s = getSesion();
  if (s) {
    if (esCliente()) items.push(link('/pedidos', 'Mis pedidos'));
    items.push(link('/perfil', s.usuario.nombre.split(' ')[0]));
    items.push(h('button', { type: 'button', onclick: () => { setSesion(null); location.hash = '#/'; render(); } }, 'Salir'));
  } else {
    items.push(link('/ingresar', 'Ingresar'), link('/registro', 'Crear cuenta'));
  }
  navEl.replaceChildren(...items);
}

function render() {
  limpiezas.forEach((f) => f());
  limpiezas = [];
  const [ruta, qs] = (location.hash.slice(1) || '/').split('?');
  const query = new URLSearchParams(qs || '');
  const hit = RUTAS.map((r) => [r, r[0].exec(ruta)]).find(([, m]) => m);
  root.replaceChildren();
  root.classList.toggle('full', ruta === '/'); // el menú usa todo el ancho de la pantalla
  navEl.classList.remove('open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
  pintarNav();
  if (!hit) {
    document.title = 'No encontrada | Brookies Coffee';
    root.append(h('h1', {}, 'Página no encontrada'), h('p', {}, 'La dirección no existe. ', h('a', { href: '#/' }, 'Volver al menú')));
    return;
  }
  const [[, fn, titulo, acceso], m] = hit;
  if ((acceso === 'cliente' && !esCliente()) || (acceso === 'sesion' && !getSesion()) || (acceso === 'admin' && !esAdmin())) {
    if (!getSesion()) { sessionStorage.setItem('brookies.vuelta', `#${ruta}`); location.hash = '#/ingresar'; return; }
    root.append(h('h1', {}, 'Sin permiso'), h('p', {}, 'Tu cuenta no puede ver esta página. ', h('a', { href: '#/' }, 'Volver al menú')));
    return;
  }
  document.title = `${titulo} | Brookies Coffee`;
  fn(root, nav, m, query);
  root.focus({ preventScroll: true }); // el lector de pantalla anuncia la nueva página
  window.scrollTo(0, 0);
}

document.getElementById('nav-toggle').addEventListener('click', (e) => {
  const open = navEl.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});
// Logo: si existe img/mascota.png (la mascota de Brookies) se usa en vez del logo genérico.
const mascota = new Image();
mascota.onload = () => {
  document.querySelector('.brand img').src = mascota.src;
  const icono = document.querySelector('link[rel="icon"]');
  icono.type = 'image/png';
  icono.href = mascota.src;
};
mascota.src = 'img/mascota.png';

window.addEventListener('hashchange', render);
window.addEventListener('carrito', pintarNav);
window.addEventListener('sesion-vencida', () => { sessionStorage.setItem('brookies.vuelta', location.hash); location.hash = '#/ingresar'; render(); });
render();
