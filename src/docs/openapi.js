'use strict';

/** Especificación OpenAPI 3 de la API (se sirve en /api-docs y /api-docs.json). */

const err = (d) => ({ description: d, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const okRes = (d, schema) => ({ description: d, content: { 'application/json': { schema: { type: 'object', properties: { data: schema, errors: { type: 'array', items: {} } } } } } });
const id = (name) => ({ name, in: 'path', required: true, schema: { type: 'integer', minimum: 1 } });
const body = (ref) => ({ required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });
const secured = [{ bearerAuth: [] }];
const common = { 400: err('datos inválidos'), 401: err('falta iniciar sesión o el token no sirve'), 403: err('el rol no tiene permiso'), 429: err('demasiadas peticiones') };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Brookies Coffee API',
    version: '2.0.0',
    description: 'API REST de pedidos e inventario de Brookies Coffee. Datos en MongoDB. Las respuestas siempre tienen la forma { data, errors }.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Autenticación' }, { name: 'Menú' }, { name: 'Pedidos' }, { name: 'Insumos' }, { name: 'Reportes' }, { name: 'Local' }, { name: 'Estado' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { data: { nullable: true }, errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } } } },
      Registro: { type: 'object', required: ['nombre', 'correo', 'contrasena'], properties: { nombre: { type: 'string' }, correo: { type: 'string', format: 'email' }, contrasena: { type: 'string', minLength: 8, description: 'mínimo 8 caracteres y un número' }, telefono: { type: 'string' }, direccion: { type: 'string' } } },
      Login: { type: 'object', required: ['correo', 'contrasena'], properties: { correo: { type: 'string' }, contrasena: { type: 'string' } } },
      Perfil: { type: 'object', required: ['nombre'], properties: { nombre: { type: 'string' }, telefono: { type: 'string' }, direccion: { type: 'string' } } },
      Carrito: { type: 'object', required: ['items'], properties: { items: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', required: ['producto_id', 'cantidad'], properties: { producto_id: { type: 'integer' }, cantidad: { type: 'integer', minimum: 1, maximum: 50 } } } } } },
      Pago: { type: 'object', required: ['numero_tarjeta'], properties: { numero_tarjeta: { type: 'string', description: '13 a 19 dígitos. Termina en 0002: rechazada (sandbox). No se guarda.' } } },
      Estado: { type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['recibido', 'en_preparacion', 'listo'] } } },
      Producto: { type: 'object', required: ['nombre', 'descripcion', 'precio', 'categoria', 'tipo_preparacion', 'disponible'], properties: { nombre: { type: 'string' }, descripcion: { type: 'string' }, precio: { type: 'integer', minimum: 1 }, categoria: { type: 'string', enum: ['Café', 'Té', 'Galleta'] }, tipo_preparacion: { type: 'string', enum: ['caliente', 'frio', 'no_aplica'] }, disponible: { type: 'boolean' } } },
      Insumo: { type: 'object', required: ['nombre', 'unidad_medida', 'stock_actual', 'stock_minimo'], properties: { nombre: { type: 'string' }, unidad_medida: { type: 'string', enum: ['g', 'ml', 'unidad'] }, stock_actual: { type: 'number' }, stock_minimo: { type: 'number' }, contiene_gluten: { type: 'boolean' }, contiene_lactosa: { type: 'boolean' }, es_origen_animal: { type: 'boolean' } } },
      RecetaItem: { type: 'object', required: ['id_insumo', 'cantidad_requerida'], properties: { id_insumo: { type: 'integer' }, cantidad_requerida: { type: 'number' } } },
      Restock: { type: 'object', required: ['cantidad'], properties: { cantidad: { type: 'number', exclusiveMinimum: 0 } } },
      Venta: { type: 'object', required: ['cantidad'], properties: { cantidad: { type: 'integer', minimum: 1, maximum: 500 } } },
    },
  },
  paths: {
    '/health': { get: { tags: ['Estado'], summary: 'Comprueba la aplicación y la base de datos', responses: { 200: okRes('ok', { type: 'object' }), 503: err('base de datos no disponible') } } },
    '/api/v1/local': { get: { tags: ['Local'], summary: 'Horarios, ubicación y contacto (RF17)', responses: { 200: okRes('datos del local', { type: 'object' }) } } },
    '/api/v1/auth/register': { post: { tags: ['Autenticación'], summary: 'Crea una cuenta de cliente y abre sesión (RF01)', requestBody: body('Registro'), responses: { 201: okRes('cuenta creada con token', { type: 'object' }), 400: err('datos inválidos'), 409: err('el correo ya existe'), 429: err('demasiados intentos') } } },
    '/api/v1/auth/login': { post: { tags: ['Autenticación'], summary: 'Inicia sesión y entrega un token JWT de 8 horas (RF02)', requestBody: body('Login'), responses: { 200: okRes('token y usuario', { type: 'object' }), 400: err('datos inválidos'), 401: err('correo o contraseña incorrectos'), 429: err('demasiados intentos') } } },
    '/api/v1/users/me': {
      get: { tags: ['Autenticación'], summary: 'Datos del usuario con sesión', security: secured, responses: { 200: okRes('usuario', { type: 'object' }), 401: err('sin sesión') } },
      put: { tags: ['Autenticación'], summary: 'Edita los datos personales del cliente (RF03)', security: secured, requestBody: body('Perfil'), responses: { 200: okRes('usuario actualizado', { type: 'object' }), 400: err('datos inválidos'), 401: err('sin sesión'), 403: err('solo clientes') } },
    },
    '/api/v1/products': {
      get: {
        tags: ['Menú'], summary: 'Consulta de productos con filtros (RF04)',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['Café', 'Té', 'Galleta', 'todas'] } },
          { name: 'available', in: 'query', schema: { type: 'boolean', default: true }, description: 'true: solo los que se pueden pedir ahora' },
          { name: 'name', in: 'query', schema: { type: 'string' } },
          { name: 'suitable_for', in: 'query', schema: { type: 'string', enum: ['sin_gluten', 'sin_lactosa', 'vegano'] } },
          { name: 'preparation', in: 'query', schema: { type: 'string', enum: ['caliente', 'frio', 'no_aplica'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['nombre', 'precio', 'mas_vendido'] } },
        ],
        responses: { 200: okRes('lista de productos', { type: 'array', items: { type: 'object' } }), 400: err('filtro inválido') },
      },
      post: { tags: ['Menú'], summary: 'Agrega un producto al menú (RF15)', security: secured, requestBody: body('Producto'), responses: { 201: okRes('producto creado', { type: 'object' }), 409: err('el nombre ya existe'), ...common } },
    },
    '/api/v1/products/{id}': {
      get: { tags: ['Menú'], summary: 'Un producto con su receta', parameters: [id('id')], responses: { 200: okRes('producto', { type: 'object' }), 404: err('no existe') } },
      put: { tags: ['Menú'], summary: 'Reemplaza los datos de un producto (RF15)', security: secured, parameters: [id('id')], requestBody: body('Producto'), responses: { 200: okRes('producto', { type: 'object' }), 404: err('no existe'), 409: err('el nombre ya existe'), ...common } },
      delete: { tags: ['Menú'], summary: 'Elimina un producto sin ventas (RF15)', security: secured, parameters: [id('id')], responses: { 200: okRes('eliminado', { type: 'object' }), 404: err('no existe'), 409: err('tiene ventas'), ...common } },
    },
    '/api/v1/products/{id}/recipe': { post: { tags: ['Menú'], summary: 'Agrega o actualiza un insumo de la receta (RF12)', security: secured, parameters: [id('id')], requestBody: body('RecetaItem'), responses: { 201: okRes('producto con receta', { type: 'object' }), 404: err('no existe'), ...common } } },
    '/api/v1/products/{id}/recipe/{idInsumo}': { delete: { tags: ['Menú'], summary: 'Quita un insumo de la receta (RF12)', security: secured, parameters: [id('id'), id('idInsumo')], responses: { 200: okRes('quitado', { type: 'object' }), 404: err('no está en la receta'), ...common } } },
    '/api/v1/products/{id}/sell': { post: { tags: ['Menú'], summary: 'Descuenta insumos según la receta, venta manual (RF10)', security: secured, parameters: [id('id')], requestBody: body('Venta'), responses: { 200: okRes('inventario descontado', { type: 'object' }), 404: err('no existe'), 409: err('stock insuficiente'), 422: err('sin receta o no disponible'), ...common } } },
    '/api/v1/orders/reservations': { post: { tags: ['Pedidos'], summary: 'Reserva el stock del carrito por 10 minutos (RF05)', security: secured, requestBody: body('Carrito'), responses: { 201: okRes('reserva', { type: 'object' }), 409: err('producto no disponible o sin stock'), ...common } } },
    '/api/v1/orders/reservations/{id}': { delete: { tags: ['Pedidos'], summary: 'Cancela la reserva y libera el stock', security: secured, parameters: [id('id')], responses: { 200: okRes('cancelada', { type: 'object' }), 404: err('no existe'), 409: err('ya no está activa'), ...common } } },
    '/api/v1/orders/reservations/{id}/pay': { post: { tags: ['Pedidos'], summary: 'Paga la reserva y crea el pedido (RF06)', security: secured, parameters: [id('id')], requestBody: body('Pago'), responses: { 201: okRes('pedido creado', { type: 'object' }), 404: err('no existe'), 409: err('expiró o ya se pagó'), 422: err('pago rechazado'), ...common } } },
    '/api/v1/orders/mine': { get: { tags: ['Pedidos'], summary: 'Historial del cliente (RF07)', security: secured, responses: { 200: okRes('pedidos', { type: 'array', items: { type: 'object' } }), 401: err('sin sesión'), 403: err('solo clientes') } } },
    '/api/v1/orders': { get: { tags: ['Pedidos'], summary: 'Todos los pedidos, filtro por estado (RF18)', security: secured, parameters: [{ name: 'estado', in: 'query', schema: { type: 'string', enum: ['recibido', 'en_preparacion', 'listo'] } }], responses: { 200: okRes('pedidos', { type: 'array', items: { type: 'object' } }), ...common } } },
    '/api/v1/orders/{id}': { get: { tags: ['Pedidos'], summary: 'Un pedido (dueño o administrador)', security: secured, parameters: [id('id')], responses: { 200: okRes('pedido', { type: 'object' }), 404: err('no existe'), 401: err('sin sesión'), 403: err('pedido de otro usuario') } } },
    '/api/v1/orders/{id}/status': { patch: { tags: ['Pedidos'], summary: 'Cambia el estado del pedido, solo hacia adelante (RF18)', security: secured, parameters: [id('id')], requestBody: body('Estado'), responses: { 200: okRes('pedido', { type: 'object' }), 404: err('no existe'), 409: err('retroceso no permitido'), ...common } } },
    '/api/v1/supplies': {
      get: { tags: ['Insumos'], summary: 'Inventario (RF13); critical=true solo los críticos', security: secured, parameters: [{ name: 'critical', in: 'query', schema: { type: 'boolean' } }], responses: { 200: okRes('insumos', { type: 'array', items: { type: 'object' } }), ...common } },
      post: { tags: ['Insumos'], summary: 'Registra un insumo (RF11)', security: secured, requestBody: body('Insumo'), responses: { 201: okRes('insumo', { type: 'object' }), 409: err('el nombre ya existe'), ...common } },
    },
    '/api/v1/supplies/{id}': {
      get: { tags: ['Insumos'], summary: 'Un insumo', security: secured, parameters: [id('id')], responses: { 200: okRes('insumo', { type: 'object' }), 404: err('no existe'), ...common } },
      put: { tags: ['Insumos'], summary: 'Reemplaza los datos de un insumo (RF11)', security: secured, parameters: [id('id')], requestBody: body('Insumo'), responses: { 200: okRes('insumo', { type: 'object' }), 404: err('no existe'), 409: err('el nombre ya existe'), ...common } },
      delete: { tags: ['Insumos'], summary: 'Elimina un insumo que ninguna receta use (RF11)', security: secured, parameters: [id('id')], responses: { 200: okRes('eliminado', { type: 'object' }), 404: err('no existe'), 409: err('está en una receta'), ...common } },
    },
    '/api/v1/supplies/{id}/restock': { patch: { tags: ['Insumos'], summary: 'Suma stock a un insumo (RF14)', security: secured, parameters: [id('id')], requestBody: body('Restock'), responses: { 200: okRes('insumo', { type: 'object' }), 404: err('no existe'), ...common } } },
    '/api/v1/reports/queries': { get: { tags: ['Reportes'], summary: 'Texto de las 13 consultas en MQL', security: secured, responses: { 200: okRes('consultas', { type: 'array', items: { type: 'object' } }), ...common } } },
    '/api/v1/reports/top-products': { get: { tags: ['Reportes'], summary: 'Productos más vendidos (RF16, consulta 04)', security: secured, responses: { 200: okRes('ranking', { type: 'array', items: { type: 'object' } }), ...common } } },
    '/api/v1/reports/critical-supplies': { get: { tags: ['Reportes'], summary: 'Insumos críticos y productos afectados (RF13, consulta 05)', security: secured, responses: { 200: okRes('lista', { type: 'array', items: { type: 'object' } }), ...common } } },
  },
};
