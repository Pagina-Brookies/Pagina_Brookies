'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render va detrás de un proxy: así el límite por IP usa la IP real del cliente
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'], // blob: para la vista previa de la imagen antes de subirla
      connectSrc: ["'self'"],
      frameSrc: ['https://www.google.com'], // mapa embebido de Google Maps en "El local"
    },
  },
}));
app.use(express.json({ limit: '50kb' }));

app.get('/api', (req, res) => {
  res.json({ data: { name: 'Brookies Coffee API', version: 'v1', health: '/health', docs: '/api-docs' }, errors: [] });
});
app.use(['/api', '/health'], apiLimiter);

try {
  const swaggerUi = require('swagger-ui-express');
  const spec = require('./docs/openapi');
  // Swagger UI usa scripts en línea: se le relaja la política solo a esa ruta
  app.use('/api-docs', (req, res, next) => { res.removeHeader('Content-Security-Policy'); next(); }, swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Brookies Coffee API' }));
  app.get('/api-docs.json', (req, res) => res.json(spec));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}

app.use(routes);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
