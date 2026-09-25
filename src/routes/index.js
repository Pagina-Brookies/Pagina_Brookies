'use strict';

const { Router } = require('express');
const health = require('../controllers/health.controller');
const productos = require('../controllers/producto.controller');
const insumos = require('../controllers/insumo.controller');
const reportes = require('../controllers/reportes.controller');

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Sistema]
 *     summary: Estado de la aplicación y de la base de datos
 *     responses:
 *       200:
 *         description: La aplicación y la base de datos responden
 */
router.get('/health', health.check);

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     tags: [Productos]
 *     summary: Consulta de productos con filtros (RF04)
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, default: todas }
 *         description: Café, Té, Galleta o todas
 *       - in: query
 *         name: available
 *         schema: { type: boolean, default: true }
 *       - in: query
 *         name: name
 *         schema: { type: string, maxLength: 100 }
 *       - in: query
 *         name: suitable_for
 *         schema: { type: string, enum: [sin_gluten, sin_lactosa, vegano] }
 *       - in: query
 *         name: preparation
 *         schema: { type: string, enum: [caliente, frio] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [precio, mas_vendido] }
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Producto' } }
 *                 errors: { type: array, items: {} }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *   post:
 *     tags: [Productos]
 *     summary: Agregar un producto al menú (RF15)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductoInput' }
 *     responses:
 *       201:
 *         description: Producto creado
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.get('/api/v1/products', productos.list);
router.post('/api/v1/products', productos.create);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     tags: [Productos]
 *     summary: Un producto con su receta
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Producto encontrado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/v1/products/:id', productos.getById);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     tags: [Productos]
 *     summary: Editar un producto (RF15)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductoInput' }
 *     responses:
 *       200: { description: Producto actualizado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *   delete:
 *     tags: [Productos]
 *     summary: Eliminar un producto (RF15)
 *     description: >
 *       Si el producto ya tiene ventas registradas (DETALLE_PEDIDO), la base de datos
 *       rechaza el borrado (ON DELETE RESTRICT) y la API responde 409, sugiriendo marcar
 *       el producto como no disponible en su lugar.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Producto eliminado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.put('/api/v1/products/:id', productos.update);
router.delete('/api/v1/products/:id', productos.remove);

/**
 * @swagger
 * /api/v1/products/{id}/recipe:
 *   post:
 *     tags: [Productos]
 *     summary: Agregar o actualizar un insumo en la receta del producto (RF12)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RecetaItemInput' }
 *     responses:
 *       201: { description: Receta actualizada }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.post('/api/v1/products/:id/recipe', productos.addRecipeItem);

/**
 * @swagger
 * /api/v1/products/{id}/recipe/{idInsumo}:
 *   delete:
 *     tags: [Productos]
 *     summary: Quitar un insumo de la receta del producto (RF12)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: idInsumo
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Insumo quitado de la receta }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.delete('/api/v1/products/:id/recipe/:idInsumo', productos.removeRecipeItem);

/**
 * @swagger
 * /api/v1/products/{id}/sell:
 *   post:
 *     tags: [Productos]
 *     summary: Descontar insumos del inventario según la receta al vender (RF10)
 *     description: >
 *       Ejecuta el UPDATE con JOIN de la consulta 07. Si la venta dejaría algún insumo
 *       bajo cero, la restricción CHECK de la base de datos rechaza la operación completa
 *       y responde 422 (ningún insumo queda descontado a medias).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SellInput' }
 *     responses:
 *       200: { description: Insumos descontados }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.post('/api/v1/products/:id/sell', productos.sell);

/**
 * @swagger
 * /api/v1/supplies:
 *   get:
 *     tags: [Insumos]
 *     summary: Inventario de insumos (RF11)
 *     parameters:
 *       - in: query
 *         name: critical
 *         schema: { type: boolean }
 *         description: Si es true, solo insumos en o bajo su stock mínimo (RF13)
 *     responses:
 *       200:
 *         description: Lista de insumos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Insumo' } }
 *                 errors: { type: array, items: {} }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *   post:
 *     tags: [Insumos]
 *     summary: Registrar un insumo (RF11)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InsumoInput' }
 *     responses:
 *       201: { description: Insumo creado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */
router.get('/api/v1/supplies', insumos.list);
router.post('/api/v1/supplies', insumos.create);

/**
 * @swagger
 * /api/v1/supplies/{id}:
 *   get:
 *     tags: [Insumos]
 *     summary: Un insumo por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Insumo encontrado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/api/v1/supplies/:id', insumos.getById);

/**
 * @swagger
 * /api/v1/supplies/{id}:
 *   put:
 *     tags: [Insumos]
 *     summary: Editar un insumo (RF11)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/InsumoInput' }
 *     responses:
 *       200: { description: Insumo actualizado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *   delete:
 *     tags: [Insumos]
 *     summary: Eliminar un insumo (RF11)
 *     description: >
 *       Si el insumo está en la receta de algún producto, la base de datos rechaza
 *       el borrado (ON DELETE RESTRICT) y la API responde 409: hay que quitarlo de
 *       esas recetas primero con DELETE /api/v1/products/{id}/recipe/{idInsumo}.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Insumo eliminado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.put('/api/v1/supplies/:id', insumos.update);
router.delete('/api/v1/supplies/:id', insumos.remove);

/**
 * @swagger
 * /api/v1/supplies/{id}/restock:
 *   patch:
 *     tags: [Insumos]
 *     summary: Reabastecer el stock de un insumo (RF14)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RestockInput' }
 *     responses:
 *       200: { description: Stock actualizado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/api/v1/supplies/:id/restock', insumos.restock);

/**
 * @swagger
 * /api/v1/reports/top-products:
 *   get:
 *     tags: [Reportes]
 *     summary: Productos más vendidos (RF16, consulta 04)
 *     responses:
 *       200: { description: Ranking de productos por unidades vendidas }
 */
router.get('/api/v1/reports/top-products', reportes.topProducts);

/**
 * @swagger
 * /api/v1/reports/critical-supplies:
 *   get:
 *     tags: [Reportes]
 *     summary: Insumos en stock crítico y los productos que los usan (RF13/RF16, consulta 05)
 *     responses:
 *       200: { description: Insumos críticos con sus productos asociados }
 */
router.get('/api/v1/reports/critical-supplies', reportes.criticalSupplies);

module.exports = router;
