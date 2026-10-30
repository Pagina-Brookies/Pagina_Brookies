// Cliente de la API: guarda la sesión, agrega el token y entrega errores con la misma forma.

const KEY = 'brookies.sesion';
let sesion = null;

try { sesion = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { sesion = null; }

export const getSesion = () => sesion;
export const esAdmin = () => Boolean(sesion && sesion.usuario.rol === 'administrador');
export const esCliente = () => Boolean(sesion && sesion.usuario.rol === 'cliente');

export function setSesion(s) {
  sesion = s;
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY);
  } catch (e) { /* sin almacenamiento: la sesión vive solo en memoria */ }
}

export class ApiError extends Error {
  constructor(status, errors) {
    super(errors.map((e) => e.message).join('. '));
    this.status = status;
    this.errors = errors;
  }
}

export async function api(method, url, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sesion) headers.Authorization = `Bearer ${sesion.token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new ApiError(0, [{ message: 'No hay conexión con el servidor. Revise su internet e intente de nuevo.' }]);
  }
  let json = null;
  try { json = await res.json(); } catch (e) { /* respuesta sin cuerpo */ }
  if (res.status === 401 && sesion && url !== '/api/v1/auth/login') {
    setSesion(null); // el token venció: se pide ingresar de nuevo
    window.dispatchEvent(new Event('sesion-vencida'));
  }
  if (!res.ok) {
    const errors = json && Array.isArray(json.errors) && json.errors.length
      ? json.errors.map((e) => (typeof e === 'string' ? { message: e } : e))
      : [{ message: res.status === 429 ? 'Demasiados intentos. Espere unos minutos.' : 'Ocurrió un error inesperado. Intente de nuevo.' }];
    throw new ApiError(res.status, errors);
  }
  return json.data;
}

export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b === undefined ? {} : b);
export const put = (u, b) => api('PUT', u, b);
export const patch = (u, b) => api('PATCH', u, b);
export const del = (u) => api('DELETE', u);

// ---- Carrito (vive en el navegador hasta que se reserva) ----
const CK = 'brookies.carrito';
let carrito = [];
try { carrito = JSON.parse(localStorage.getItem(CK)) || []; } catch (e) { carrito = []; }
const guardar = () => { try { localStorage.setItem(CK, JSON.stringify(carrito)); } catch (e) { /* ignorar */ } window.dispatchEvent(new Event('carrito')); };

export const getCarrito = () => carrito;
export const cantidadTotal = () => carrito.reduce((s, l) => s + l.cantidad, 0);
export const totalCarrito = () => carrito.reduce((s, l) => s + l.precio * l.cantidad, 0);
export function agregar(p, n = 1) {
  const l = carrito.find((x) => x.id === p.id_producto);
  if (l) l.cantidad = Math.min(50, l.cantidad + n);
  else carrito.push({ id: p.id_producto, nombre: p.nombre, precio: p.precio, cantidad: n });
  guardar();
}
export function cambiar(id, n) {
  const l = carrito.find((x) => x.id === id);
  if (!l) return;
  l.cantidad += n;
  if (l.cantidad < 1) carrito = carrito.filter((x) => x.id !== id);
  if (l.cantidad > 50) l.cantidad = 50;
  guardar();
}
export function quitar(id) { carrito = carrito.filter((x) => x.id !== id); guardar(); }
export function vaciar() { carrito = []; guardar(); }
