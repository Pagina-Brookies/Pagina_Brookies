# Brookies Coffee

Sistema web de pedidos con gestión automática de inventario para una cafetería familiar.
Proyecto del ramo ICI-324 Bases de Datos y Programación Web (Universidad de Valparaíso), Grupo 20.

- Backend: Node.js, Express y MongoDB (driver oficial).
- Frontend: página estática (HTML, CSS y JavaScript sin frameworks) que sirve el mismo Express.
- Documentación de la API: `/api-docs` (Swagger UI) y `/api-docs.json`.
- Entrega 1 (MySQL) conservada en `docs/etapa1-sql/`: consultas SQL, migraciones y resultados. No se ejecuta.

## Qué hace

Clientes: ver el menú con filtros (categoría, alérgenos, preparación, orden), armar el carrito, reservar el stock por 10 minutos, pagar con tarjeta (pasarela simulada), seguir el estado del pedido y ver su historial.
Administrador: cambiar el estado de los pedidos, gestionar insumos (alta, edición, reabastecimiento, alerta de stock crítico), menú y recetas, y ver reportes con el texto de las 13 consultas en MongoDB.

Cuando se paga un pedido, el sistema descuenta de cada insumo la cantidad de su receta. Un producto deja de estar disponible solo si le falta stock de algún insumo.

## Cómo ejecutarlo

Requisitos: Node 20 o superior y una base MongoDB. Para que funcionen las transacciones hace falta un replica set (MongoDB Atlas, incluido el plan gratis, lo es).

```bash
npm install
```

Crear un archivo `.env` (no se sube a Git) con:

```
MONGODB_URI=<cadena de conexión>
MONGODB_DB=brookies
JWT_SECRET=<texto aleatorio de al menos 16 caracteres>
```

Opcionales: `PORT` (3000), `JWT_EXPIRES_IN` (8h), `RATE_LIMIT` (300 por 15 min), `AUTH_RATE_LIMIT` (20 por 15 min), `RESERVA_MINUTOS` (10) y `MONGO_TX=off` para un MongoDB sin replica set. Para la pantalla del local: `LOCAL_DIRECCION`, `LOCAL_TELEFONO`, `LOCAL_CORREO`, `LOCAL_INSTAGRAM` (usuario sin @; por defecto `brookiescoffee.cl`), `LOCAL_HORARIO_SEMANA`, `LOCAL_HORARIO_FINDE`, `LOCAL_MAPA` (lo que se busca en Google Maps; por defecto, la Copec de Av. Edmundo Eluchans 3100, Concón, la zona donde estará el local) y `LOCAL_ABIERTO=true` para quitar el aviso de que el local aún no abre.

Recuperar contraseña (link por correo que vale 30 minutos y sirve una sola vez): `SMTP_USER` (la cuenta de Gmail) y `SMTP_PASS` (una contraseña de aplicación de Google, no la clave normal; se crea en myaccount.google.com/apppasswords con la verificación en dos pasos activada). Opcionales: `MAIL_FROM` (remitente), `SMTP_HOST` y `SMTP_PORT` (por defecto smtp.gmail.com y 465) y `APP_URL` (la dirección pública para armar el link; en Render se usa sola la que entrega la plataforma, y en local `http://localhost:3000`). Sin `SMTP_USER` ni `SMTP_PASS` no se envía nada y el link aparece en la consola del servidor.

Logo: `public/img/brookies-logo.png` (barra superior) y `public/img/favicon.png` (ícono de la pestaña). `public/img/logo.svg` queda como relleno de los productos sin foto.

```bash
npm run db:seed     # borra y carga los datos de demostración
npm start           # http://localhost:3000
npm run queries     # ejecuta las 13 consultas en orden sobre una base de prueba
npm test            # pruebas (las de integración necesitan MONGODB_URI)
```

Cuentas de demostración (contraseña `demo1234`): `admin@brookies.example` (administrador) y `ignacia.valdebenito@clientes.brookies.example` (cliente).

## Despliegue en Render

1. Crear un clúster gratuito en MongoDB Atlas y un usuario de base de datos. En Network Access permitir la IP de Render (o 0.0.0.0/0 mientras se prueba).
2. En Render crear un Web Service desde este repositorio. Build: `npm install`. Start: `npm start`.
3. Definir las variables `MONGODB_URI`, `MONGODB_DB` y `JWT_SECRET` en Environment. Nunca se escriben en el código.
4. Cargar los datos una vez, desde el computador: `npm run db:seed` con `MONGODB_URI` apuntando a Atlas.

## Estructura

```
server.js                 arranque (conexión, índices, liberación de reservas vencidas)
src/app.js                Express, helmet, límites, estáticos
src/routes/               rutas y permisos por rol
src/controllers/          validan la entrada y llaman a los modelos
src/models/               acceso a MongoDB (usuario, producto, insumo, pedido, reportes)
src/queries/mql.js        las 13 consultas en MQL
src/middleware/           JWT, roles, límite de peticiones, errores
src/services/pasarela.js  pasarela de pago simulada
src/docs/openapi.js       especificación OpenAPI
public/                   frontend
data/seed.json            datos de demostración
scripts/                  seed.js y queries.js
tests/                    validadores e integración
docs/                     informe, mockups, MongoDB y entrega 1
```

## Formato de respuesta

Toda respuesta tiene la forma `{ "data": ..., "errors": [] }`. En un error, `data` es `null` y `errors` trae objetos `{ "field", "message" }` o un texto. Códigos usados: 200, 201, 400, 401, 403, 404, 409, 413, 422, 429, 503 y 500.

## Seguridad

Contraseñas con bcrypt, sesión con JWT de 8 horas, permisos por rol en cada ruta, validación de todos los datos de entrada, consultas con valores parametrizados (nada del usuario se concatena), límite de peticiones, cabeceras de seguridad con helmet y política de contenido estricta. El número de tarjeta se usa solo para decidir el resultado del pago y nunca se guarda.
