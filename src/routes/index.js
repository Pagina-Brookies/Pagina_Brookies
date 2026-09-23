'use strict';

const { Router } = require('express');
const health = require('../controllers/health.controller');
const productos = require('../controllers/producto.controller');
const insumos = require('../controllers/insumo.controller');

const router = Router();

// Mapa de la API en un solo lugar: recurso en la URL, acción en el método HTTP.
router.get('/health', health.check);
router.get('/api/v1/products', productos.list);
router.get('/api/v1/products/:id', productos.getById);
router.get('/api/v1/supplies', insumos.list);

module.exports = router;
