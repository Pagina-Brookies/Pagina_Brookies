'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Brookies Coffee API',
    version: '1.0.0',
    description:
      'API del sistema de pedidos y gestión de inventario de Brookies Coffee (ICI-324, Grupo 20). ' +
      'Todas las respuestas comparten la forma `{ "data": ..., "errors": [] }`, tanto en éxito como en error.',
    contact: { name: 'Grupo 20 — Felipe Hernández, Simón Reyes' },
  },
  servers: [
    { url: 'http://localhost:{port}', description: 'Local', variables: { port: { default: '3000' } } },
    { url: 'https://brookies-coffee-api.onrender.com', description: 'Producción (Render)' },
  ],
  tags: [
    { name: 'Productos', description: 'Menú, receta y venta con descuento de inventario (RF04, RF10, RF12, RF15)' },
    { name: 'Insumos', description: 'Inventario, stock crítico y reabastecimiento (RF11, RF13, RF14)' },
    { name: 'Reportes', description: 'Productos más vendidos e insumos críticos (RF16)' },
    { name: 'Sistema', description: 'Estado del servicio' },
  ],
  components: {
    schemas: {
      ErrorItem: {
        type: 'object',
        properties: { field: { type: 'string' }, message: { type: 'string' } },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          data: { nullable: true, example: null },
          errors: {
            type: 'array',
            items: { oneOf: [{ type: 'string' }, { $ref: '#/components/schemas/ErrorItem' }] },
          },
        },
      },
      Producto: {
        type: 'object',
        properties: {
          id_producto: { type: 'integer', example: 3 },
          nombre: { type: 'string', example: 'Latte' },
          descripcion: { type: 'string', nullable: true, example: 'Espresso con leche texturizada' },
          precio: { type: 'number', format: 'float', example: 2900 },
          categoria: { type: 'string', enum: ['Café', 'Té', 'Galleta'], example: 'Café' },
          tipo_preparacion: { type: 'string', enum: ['caliente', 'frio', 'no_aplica'], example: 'caliente' },
          disponible: { type: 'boolean', example: true },
          disponible_efectivo: { type: 'boolean', example: true, description: 'disponible además de tener stock suficiente en su receta' },
        },
      },
      ProductoInput: {
        type: 'object',
        required: ['nombre', 'precio', 'categoria', 'disponible'],
        properties: {
          nombre: { type: 'string', maxLength: 100, example: 'Mocha' },
          descripcion: { type: 'string', maxLength: 300, nullable: true, example: 'Espresso, chocolate y leche' },
          precio: { type: 'number', minimum: 0.01, example: 3100 },
          categoria: { type: 'string', enum: ['Café', 'Té', 'Galleta'], example: 'Café' },
          tipo_preparacion: { type: 'string', enum: ['caliente', 'frio', 'no_aplica'], default: 'no_aplica' },
          disponible: { type: 'boolean', example: true },
        },
      },
      RecetaItemInput: {
        type: 'object',
        required: ['id_insumo', 'cantidad_requerida'],
        properties: {
          id_insumo: { type: 'integer', minimum: 1, example: 1 },
          cantidad_requerida: { type: 'number', minimum: 0.01, example: 16 },
        },
      },
      SellInput: {
        type: 'object',
        required: ['cantidad'],
        properties: { cantidad: { type: 'integer', minimum: 1, maximum: 500, example: 2 } },
      },
      Insumo: {
        type: 'object',
        properties: {
          id_insumo: { type: 'integer', example: 1 },
          nombre: { type: 'string', example: 'Café molido' },
          unidad_medida: { type: 'string', example: 'g' },
          stock_actual: { type: 'number', example: 4468 },
          stock_minimo: { type: 'number', example: 1000 },
          contiene_gluten: { type: 'boolean' },
          contiene_lactosa: { type: 'boolean' },
          es_origen_animal: { type: 'boolean' },
          critico: { type: 'boolean', description: 'stock_actual <= stock_minimo' },
        },
      },
      InsumoInput: {
        type: 'object',
        required: ['nombre', 'unidad_medida', 'stock_actual', 'stock_minimo', 'contiene_gluten', 'contiene_lactosa', 'es_origen_animal'],
        properties: {
          nombre: { type: 'string', maxLength: 100, example: 'Sirope de caramelo' },
          unidad_medida: { type: 'string', maxLength: 20, example: 'ml' },
          stock_actual: { type: 'number', minimum: 0, example: 3000 },
          stock_minimo: { type: 'number', minimum: 0, example: 500 },
          contiene_gluten: { type: 'boolean', example: false },
          contiene_lactosa: { type: 'boolean', example: false },
          es_origen_animal: { type: 'boolean', example: false },
        },
      },
      RestockInput: {
        type: 'object',
        required: ['cantidad'],
        properties: { cantidad: { type: 'number', minimum: 0.01, example: 500 } },
      },
    },
    responses: {
      BadRequest: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      NotFound: { description: 'No existe', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Conflict: { description: 'Conflicto con el estado actual de los datos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      Unprocessable: { description: 'No se pudo aplicar la operación (restricción de negocio o de la base de datos)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    },
  },
};

const options = {
  definition,
  apis: [path.join(__dirname, '..', 'routes', '*.js')],
};

module.exports = swaggerJsdoc(options);
