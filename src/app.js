'use strict';

const express = require('express');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    data: { name: 'Brookies Coffee API', version: 'v1', health: '/health', products: '/api/v1/products' },
    errors: [],
  });
});
app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
