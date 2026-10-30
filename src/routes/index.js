'use strict';

const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, requireRole } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const health = require('../controllers/health.controller');
const auth = require('../controllers/auth.controller');
const local = require('../controllers/local.controller');
const productos = require('../controllers/producto.controller');
const insumos = require('../controllers/insumo.controller');
const pedidos = require('../controllers/pedido.controller');
const reportes = require('../controllers/reportes.controller');

const router = express.Router();
const admin = [requireAuth, requireRole('administrador')];
const cliente = [requireAuth, requireRole('cliente')];
const w = wrap;

// Públicas
router.get('/health', w(health.check));
router.get('/api/v1/local', local.info);
router.post('/api/v1/auth/register', authLimiter, w(auth.register));
router.post('/api/v1/auth/login', authLimiter, w(auth.login));
router.get('/api/v1/products', w(productos.list));
router.get('/api/v1/products/:id', w(productos.getById));
router.get('/media/productos/:id', w(productos.getImage));

// Cuenta (cualquier usuario con sesión; el perfil editable es del cliente)
router.get('/api/v1/users/me', requireAuth, w(auth.me));
router.put('/api/v1/users/me', requireAuth, w(auth.updateMe));

// Pedidos del cliente
router.post('/api/v1/orders/reservations', ...cliente, w(pedidos.reserve));
router.delete('/api/v1/orders/reservations/:id', ...cliente, w(pedidos.cancelReservation));
router.post('/api/v1/orders/reservations/:id/pay', ...cliente, w(pedidos.pay));
router.get('/api/v1/orders/mine', ...cliente, w(pedidos.mine));

// Pedidos: administrador
router.get('/api/v1/orders', ...admin, w(pedidos.list));
router.patch('/api/v1/orders/:id/status', ...admin, w(pedidos.setStatus));
// dueño o administrador (se valida dentro)
router.get('/api/v1/orders/:id', requireAuth, w(pedidos.getById));

// Menú y recetas: administrador
router.post('/api/v1/products', ...admin, w(productos.create));
router.put('/api/v1/products/:id', ...admin, w(productos.update));
router.delete('/api/v1/products/:id', ...admin, w(productos.remove));
router.post('/api/v1/products/:id/recipe', ...admin, w(productos.addRecipeItem));
router.delete('/api/v1/products/:id/recipe/:idInsumo', ...admin, w(productos.removeRecipeItem));
router.post('/api/v1/products/:id/sell', ...admin, w(productos.sell));
// la imagen viaja como binario (no JSON); el frontend la achica antes de subirla, 2 MB es margen de sobra
const imagen = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' });
router.put('/api/v1/products/:id/image', ...admin, imagen, w(productos.putImage));
router.delete('/api/v1/products/:id/image', ...admin, w(productos.removeImage));

// Inventario y reportes: administrador
router.get('/api/v1/supplies', ...admin, w(insumos.list));
router.post('/api/v1/supplies', ...admin, w(insumos.create));
router.get('/api/v1/supplies/:id', ...admin, w(insumos.getById));
router.put('/api/v1/supplies/:id', ...admin, w(insumos.update));
router.delete('/api/v1/supplies/:id', ...admin, w(insumos.remove));
router.patch('/api/v1/supplies/:id/restock', ...admin, w(insumos.restock));
router.patch('/api/v1/supplies/:id/withdraw', ...admin, w(insumos.withdraw));
router.get('/api/v1/reports/queries', ...admin, w(reportes.queries));
router.get('/api/v1/reports/top-products', ...admin, w(reportes.topProducts));
router.get('/api/v1/reports/critical-supplies', ...admin, w(reportes.criticalSupplies));

module.exports = router;
