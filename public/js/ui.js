// Utilidades de interfaz. Todo el HTML se arma con nodos del DOM (nunca con innerHTML),
// así ningún texto que venga del servidor o del usuario puede ejecutarse como código.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clp = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
export const fecha = (d) => new Date(d).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
export const num = (n) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  // un dialog abierto queda por encima de todo: el aviso se mueve adentro para que no quede tapado
  const abierto = document.querySelector('dialog[open]');
  if (t.parentElement !== (abierto || document.body)) (abierto || document.body).append(t);
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/** Aviso en pantalla. role="alert" hace que el lector de pantalla lo anuncie al aparecer. */
export function alerta(tipo, titulo, detalle) {
  return h('div', { class: `alert ${tipo}`, role: tipo === 'error' ? 'alert' : 'status' },
    h('strong', {}, titulo), detalle ? h('span', {}, ' ', detalle) : null);
}

/** Muestra los errores del servidor: los de un campo van junto al campo y el resto en un aviso. */
export function mostrarErrores(form, err, avisoEl) {
  form.querySelectorAll('.field-error').forEach((e) => e.remove());
  form.querySelectorAll('[aria-invalid]').forEach((e) => { e.removeAttribute('aria-invalid'); });
  const sueltos = [];
  let primero = null;
  for (const e of err.errors || [{ message: err.message }]) {
    const campo = e.field && form.querySelector(`[name="${e.field}"]`);
    if (campo) {
      const id = `err-${e.field.replace(/\W/g, '-')}`;
      const p = h('p', { class: 'field-error', id }, e.message);
      campo.setAttribute('aria-invalid', 'true');
      campo.setAttribute('aria-describedby', [campo.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
      campo.closest('.field').append(p);
      primero = primero || campo;
    } else sueltos.push(e.message);
  }
  if (avisoEl) {
    avisoEl.replaceChildren();
    if (sueltos.length) avisoEl.append(alerta('error', 'No se pudo completar.', sueltos.join('. ')));
  }
  if (primero) primero.focus(); else if (avisoEl && sueltos.length) avisoEl.scrollIntoView({ block: 'center' });
}

/** Abreviatura de cada unidad de medida, la que se muestra dentro de los campos de cantidad. */
export const UNIDAD = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', unidad: 'u.' };

/** Pone la unidad dentro del cuadro del número, a la derecha (entre el texto y las flechas). */
export function conUnidad(input, unidad) {
  input.classList.add('con-unidad');
  return h('span', { class: 'unit-input' }, input, h('span', { class: 'unit', 'aria-hidden': 'true' }, UNIDAD[unidad] || unidad));
}

/** Cambia la unidad que muestra un campo armado con conUnidad (o con campo({ unit })). */
export function cambiarUnidad(contenedor, unidad) {
  contenedor.querySelectorAll('.unit').forEach((u) => { u.textContent = UNIDAD[unidad] || unidad; });
}

/** Campo de formulario con etiqueta visible, ayuda y atributos de accesibilidad. */
export function campo({ opcional = true, id, name, label, type = 'text', value = '', hint, required, autocomplete, inputmode, min, max, step, maxlength, options, unit, children }) {
  const hintId = hint ? `${id}-hint` : null;
  let control;
  if (options) {
    control = h('select', { id, name: name || id, required, 'aria-describedby': hintId },
      options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t)));
  } else {
    control = h('input', { id, name: name || id, type, value, required, autocomplete, inputmode, min, max, step, maxlength, 'aria-describedby': hintId });
    if (unit) control = conUnidad(control, unit);
  }
  return h('div', { class: 'field' },
    h('label', { for: id }, label, required || options || !opcional ? '' : ' (opcional)'),
    control, hint ? h('p', { class: 'hint', id: hintId }, hint) : null, children);
}

export function skeletons(n = 6) {
  const w = h('div', { class: 'cards', role: 'status', 'aria-label': 'Cargando' });
  for (let i = 0; i < n; i++) w.append(h('div', { class: 'skeleton' }));
  w.append(h('span', { class: 'sr-only' }, 'Cargando…'));
  return w;
}

export const vacio = (msg) => h('div', { class: 'empty' }, msg);

/** Pone un botón en estado "trabajando" para evitar dobles envíos. */
export async function ocupado(btn, texto, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = texto;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = original; }
}

/**
 * Ventana emergente sobre la página (dialog nativo: bloquea el fondo, Esc la cierra y el foco queda dentro).
 * Devuelve { cuerpo, cerrar }. Al cerrarse por cualquier vía se quita del DOM y se llama alCerrar.
 */
export function modal(titulo, { ancho = '', alCerrar } = {}) {
  const tituloId = `modal-${Date.now()}`;
  const cuerpo = h('div', { class: 'modal-body' });
  const dlg = h('dialog', { class: `modal ${ancho}`, 'aria-labelledby': tituloId },
    h('div', { class: 'modal-head' }, h('h2', { id: tituloId }, titulo),
      h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Cerrar ventana', onclick: () => dlg.close() }, '×')),
    cuerpo);
  dlg.addEventListener('close', () => {
    const aviso = dlg.querySelector('#toast'); // si toast() lo movió adentro, vuelve a la página antes de borrar la ventana
    if (aviso) document.body.append(aviso);
    dlg.remove();
    if (alCerrar) alCerrar();
  });
  document.body.append(dlg);
  dlg.showModal();
  return { cuerpo, dlg, cerrar: () => { if (dlg.open) dlg.close(); } };
}

/** Descarga un texto como archivo, sin pasar por el servidor. */
export function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h('a', { href: url, download: nombre, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ESTADOS = {
  recibido: ['Recibido', 'wait'],
  en_preparacion: ['En preparación', 'warn'],
  listo: ['Listo para retirar', 'ok'],
};
export const estadoTag = (e) => h('span', { class: `status ${ESTADOS[e][1]}` }, ESTADOS[e][0]);
