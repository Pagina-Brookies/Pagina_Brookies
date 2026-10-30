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

/** Campo de formulario con etiqueta visible, ayuda y atributos de accesibilidad. */
export function campo({ opcional = true, id, name, label, type = 'text', value = '', hint, required, autocomplete, inputmode, min, max, step, maxlength, options, children }) {
  const hintId = hint ? `${id}-hint` : null;
  let control;
  if (options) {
    control = h('select', { id, name: name || id, required, 'aria-describedby': hintId },
      options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t)));
  } else {
    control = h('input', { id, name: name || id, type, value, required, autocomplete, inputmode, min, max, step, maxlength, 'aria-describedby': hintId });
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

export const ESTADOS = {
  recibido: ['Recibido', 'wait'],
  en_preparacion: ['En preparación', 'warn'],
  listo: ['Listo para retirar', 'ok'],
};
export const estadoTag = (e) => h('span', { class: `status ${ESTADOS[e][1]}` }, ESTADOS[e][0]);
