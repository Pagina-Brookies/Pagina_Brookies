'use strict';

const { col, nextId } = require('../config/mongo');

/** Lo que se devuelve al cliente: nunca el hash de la contraseña. */
function toPublic(u) {
  if (!u) return null;
  return {
    id_usuario: u._id,
    rol: u.rol,
    nombre: u.nombre,
    correo: u.correo,
    telefono: u.cliente ? u.cliente.telefono || null : null,
    direccion: u.cliente ? u.cliente.direccion || null : null,
    fecha_registro: u.fecha_registro,
    cargo: u.administrador ? u.administrador.cargo : null,
  };
}

const findById = (id) => col('usuarios').findOne({ _id: id });
const findByEmail = (correo) => col('usuarios').findOne({ correo });

/** RF01: crea una cuenta de cliente. El correo ya viene en minúscula; el índice único evita repetidos. */
async function createClient({ nombre, correo, contrasena_hash, telefono, direccion }) {
  const _id = await nextId('usuarios');
  const cliente = {};
  if (telefono) cliente.telefono = telefono; // si no hay dato, el campo se omite en vez de guardar null
  if (direccion) cliente.direccion = direccion;
  const doc = {
    _id,
    rol: 'cliente',
    nombre,
    correo,
    contrasena_hash,
    fecha_registro: new Date().toISOString().slice(0, 10), // solo el día, como texto (ver informe 7.3)
    ultimo_acceso: new Date(),
    activo: true,
    cliente,
  };
  await col('usuarios').insertOne(doc);
  return doc;
}

const touchLogin = (id) => col('usuarios').updateOne({ _id: id }, { $set: { ultimo_acceso: new Date() } });

/** RF03: edita los datos personales. Teléfono y dirección vacíos se quitan del documento. */
async function updateProfile(id, { nombre, telefono, direccion }) {
  const $set = { nombre };
  const $unset = {};
  if (telefono) $set['cliente.telefono'] = telefono; else $unset['cliente.telefono'] = '';
  if (direccion) $set['cliente.direccion'] = direccion; else $unset['cliente.direccion'] = '';
  const update = Object.keys($unset).length ? { $set, $unset } : { $set };
  const res = await col('usuarios').findOneAndUpdate({ _id: id, rol: 'cliente' }, update, { returnDocument: 'after' });
  if (res) {
    // el nombre también se copia en los pedidos nuevos (no en los antiguos: son un historial, ver informe 7.2)
  }
  return res;
}

/** Recuperación de contraseña: se guarda solo el hash del token, nunca el token del link. */
const setReset = (id, token_hash, expira_en) => col('usuarios').updateOne({ _id: id }, { $set: { recuperacion: { token_hash, expira_en } } });

const findByResetHash = (token_hash) => col('usuarios').findOne({ 'recuperacion.token_hash': token_hash, 'recuperacion.expira_en': { $gt: new Date() }, activo: true });

/**
 * Cambia la contraseña y borra el token en la misma operación: el link sirve una sola vez.
 * contrasena_cambiada deja sin efecto las sesiones abiertas antes del cambio (ver requireAuth).
 */
const resetPassword = (id, token_hash, contrasena_hash) => col('usuarios').updateOne(
  { _id: id, 'recuperacion.token_hash': token_hash },
  { $set: { contrasena_hash, contrasena_cambiada: new Date() }, $unset: { recuperacion: '' } },
);

module.exports = { toPublic, findById, findByEmail, createClient, touchLogin, updateProfile, setReset, findByResetHash, resetPassword };
