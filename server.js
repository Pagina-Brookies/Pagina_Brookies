'use strict';

require('dotenv').config();
const app = require('./src/app');
const { connect, ensureIndexes, close } = require('./src/config/mongo');
const { secret } = require('./src/middleware/auth');
const { releaseExpired } = require('./src/models/pedido.model');

const PORT = process.env.PORT || 3000;

async function main() {
  secret(); // falla al arrancar si falta JWT_SECRET
  await connect();
  await ensureIndexes();
  const timer = setInterval(() => releaseExpired().catch((e) => console.error('[reservas]', e.message)), 60000);
  const server = app.listen(PORT, () => console.log(`Brookies Coffee API escuchando en el puerto ${PORT}`));
  const stop = () => { clearInterval(timer); server.close(() => close().then(() => process.exit(0))); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => { console.error('No se pudo iniciar:', e.message); process.exit(1); });
