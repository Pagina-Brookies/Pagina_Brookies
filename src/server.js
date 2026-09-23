'use strict';

require('dotenv').config();
const app = require('./app');
const { closePool } = require('./config/db');

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log(`Brookies Coffee API escuchando en el puerto ${port}`);
});

// Cierre ordenado (Render envía SIGTERM al reiniciar el servicio)
function shutdown(signal) {
  console.log(`${signal} recibido, cerrando...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
