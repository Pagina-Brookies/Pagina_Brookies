'use strict';

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./docs/swagger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    data: {
      name: 'Brookies Coffee API', version: 'v1',
      health: '/health', products: '/api/v1/products', docs: '/api-docs',
    },
    errors: [],
  });
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'Brookies Coffee API' }));
app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
