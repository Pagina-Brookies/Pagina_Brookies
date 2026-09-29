# Brookies Coffee

Sistema web de pedidos y gestión de inventario para la cafetería Brookies Coffee.
Proyecto del ramo **ICI-324 Bases de Datos y Programación Web** (Universidad de Valparaíso), **Grupo 20**.

- **Integrantes:** Felipe Hernández Olivares · Simón Reyes Morales
- **Profesor:** Benjamín Serrano
- **Etapa:** 1 (base de datos implementada, conexión desde la aplicación y 13 consultas SQL)
- **Backend desplegado:** https://brookies-coffee-api.onrender.com

## Dónde vive el proyecto (Etapa 1)

- **Backend (API):** desplegado en [Render](https://render.com), plan gratuito, en
  https://brookies-coffee-api.onrender.com. Se redeploya solo con cada push a `main`.
- **Base de datos:** MySQL en [Aiven](https://aiven.io), plan gratuito (servicio `brookies-db`).
  El backend se conecta a ella por SSL (variables `DB_SSL` y `DB_SSL_CA_CONTENT` en Render).

Para comprobar que está arriba, desde cualquier computador (no hace falta el nuestro):
- https://brookies-coffee-api.onrender.com/health → estado de la app y de la base
- https://brookies-coffee-api.onrender.com/api/v1/products → menú con filtros
- https://brookies-coffee-api.onrender.com/api-docs → documentación interactiva (Swagger)

> **Nota:** el plan gratuito de Render "duerme" el servicio después de 15 minutos sin tráfico.
> La primera petición después de eso puede demorar hasta un minuto en responder mientras despierta;
> no es un error. Conviene abrir `/health` un par de minutos antes de mostrarlo en vivo.

## Qué hace

El cliente consulta el menú, arma su pedido y paga en línea. El administrador gestiona insumos, recetas y menú.
Cuando se confirma una venta, el sistema descuenta los insumos según la receta de cada producto y avisa
cuando el stock de un insumo llega a su nivel crítico. Más detalle en el informe (`docs/`).

## Tecnologías

Node.js 18 o superior · Express · MySQL 8.0.16 o superior · `mysql2` (SQL parametrizado, sin ORM)

## Cómo correrlo en tu computador

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Crea una base de datos MySQL vacía (por ejemplo `brookies`) y un usuario con permisos sobre ella.
3. Copia `.env.example` como `.env` y completa los valores (host, usuario, clave y nombre de la base).
   El archivo `.env` no se sube al repositorio.
4. Crea las tablas y carga los datos de prueba:
   ```bash
   npm run db:reset
   ```
   Este comando **borra y vuelve a crear** las tablas del proyecto: úsalo solo en una base de desarrollo.
5. Levanta el servidor:
   ```bash
   npm start
   ```
   Comprueba que responde en `http://localhost:3000/health`.

Los usuarios de prueba (`admin@brookies.example`, `camila.rojas@example.com`, …) tienen la contraseña `demo1234`,
guardada como hash. Son datos ficticios.

## Las 13 consultas SQL

Están en `queries/`, una por archivo, y se ejecutan desde la aplicación con:

```bash
npm run db:reset      # deja la base con los datos de prueba originales
npm run queries       # ejecuta las 13 y muestra los resultados
npm run queries:md    # además escribe docs/resultados_consultas.md
```

| N° | Tipo | Qué hace |
|---|---|---|
| 01 | ALTER | Agrega un índice sobre `producto.categoria` |
| 02 | ALTER | Agrega `fecha_respaldo` a la tabla de respaldo temporal |
| 03 | SELECT | Consulta de productos con filtros (categoría, disponibilidad, tipo de preparación) |
| 04 | SELECT (JOIN) | Productos más vendidos |
| 05 | SELECT (JOIN de 3 tablas) | Insumos en stock crítico y productos que los usan |
| 06 | UPDATE | Reabastecer el stock de un insumo |
| 07 | UPDATE (JOIN) | Descontar insumos según la receta de un producto |
| 08 | INSERT | Registrar un insumo |
| 09 | INSERT | Agregar un producto al menú |
| 10 | INSERT … SELECT | Agregar un insumo a la receta de un producto |
| 11 | DELETE | Quitar un insumo de una receta |
| 12 | DELETE | Eliminar un pedido de prueba (CASCADE a detalle y pago) |
| 13 | DROP | Eliminar la tabla de respaldo temporal |

Las consultas SELECT (03, 04 y 05) están en álgebra relacional en `docs/algebra_relacional.md`.

## API

Documentación interactiva (Swagger / OpenAPI): https://brookies-coffee-api.onrender.com/api-docs
— se puede probar cada endpoint desde el navegador, con el botón "Try it out". El JSON crudo del
spec está en https://brookies-coffee-api.onrender.com/api-docs.json

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la aplicación y de la base de datos |
| GET | `/api/v1/products` | Consulta de productos con filtros (RF04) |
| GET | `/api/v1/products/:id` | Un producto con su receta |
| POST | `/api/v1/products` | Agregar un producto al menú (RF15) |
| PUT | `/api/v1/products/:id` | Editar un producto (RF15) |
| DELETE | `/api/v1/products/:id` | Eliminar un producto (RF15); bloqueado (409) si ya tiene ventas registradas |
| POST | `/api/v1/products/:id/recipe` | Agregar o actualizar un insumo en la receta (RF12) |
| DELETE | `/api/v1/products/:id/recipe/:idInsumo` | Quitar un insumo de la receta (RF12) |
| POST | `/api/v1/products/:id/sell` | Descontar insumos según receta al vender (RF10) |
| GET | `/api/v1/supplies?critical=true` | Inventario de insumos (RF11); solo críticos con `critical=true` (RF13) |
| GET | `/api/v1/supplies/:id` | Un insumo |
| POST | `/api/v1/supplies` | Registrar un insumo (RF11) |
| PUT | `/api/v1/supplies/:id` | Editar un insumo (RF11) |
| DELETE | `/api/v1/supplies/:id` | Eliminar un insumo (RF11); bloqueado (409) si está en alguna receta |
| PATCH | `/api/v1/supplies/:id/restock` | Reabastecer stock (RF14) |
| GET | `/api/v1/reports/top-products` | Productos más vendidos (RF16, consulta 04) |
| GET | `/api/v1/reports/critical-supplies` | Insumos críticos y sus productos (RF16, consulta 05) |

Filtros de `GET /api/v1/products`: `category` (por defecto `todas`), `available` (por defecto `true`, considera el stock de
la receta), `name`, `suitable_for` (`sin_gluten`, `sin_lactosa`, `vegano`), `preparation` (`caliente`, `frio`) y
`sort` (`precio`, `mas_vendido`).

Ejemplo: `GET /api/v1/products?category=Galleta&suitable_for=vegano&sort=precio`

Cada producto trae además `apto_para` (por ejemplo `["sin_gluten", "vegano"]`), calculado desde los insumos de su receta.

Todas las respuestas tienen la misma forma: `{ "data": ..., "errors": [] }`. Códigos que usa la API:

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos: negativos, texto en campos numéricos, valores fuera de lista, más de 2 decimales, JSON mal escrito |
| 404 | El recurso no existe |
| 409 | Nombre repetido, o borrar algo que está en uso (insumo en una receta, producto con ventas) |
| 413 | Cuerpo de la petición demasiado grande |
| 422 | Regla de negocio: vender sin stock suficiente, vender un producto no disponible o sin receta, desbordar el stock |
| 503 | La base de datos no está disponible (por ejemplo, Aiven apagado por inactividad) |
| 500 | Error inesperado; el detalle queda en el registro del servidor |

### Validación de entradas

Todos los endpoints de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) validan cada campo antes de tocar la base de datos:
números negativos, texto donde va un número, más de 2 decimales, booleanos mal tipados (`"true"` en vez de `true`),
valores fuera de una lista fija, campos faltantes y textos vacíos o demasiado largos se rechazan con 400 y un detalle
por campo. Listas fijas: categoría (`Café`, `Té`, `Galleta`), tipo de preparación (`caliente`, `frio`, `no_aplica`) y
unidad de medida (`g`, `kg`, `ml`, `l`, `unidad`); se aceptan sin importar mayúsculas ni tildes (`cafe` se guarda como
`Café`). Los nombres de productos e insumos no pueden repetirse.

Dos formas de probarlo:

```bash
npm test            # pruebas unitarias de cada validador
npm run test:api    # recorre la API con ~87 casos válidos e inválidos (requiere el servidor corriendo)
API_URL=https://brookies-coffee-api.onrender.com npm run test:api   # lo mismo, contra producción
```

`test:api` borra al final todo lo que crea para probar; no vende ni reabastece con éxito, así que no cambia el stock.

La consulta 07 (descontar insumos según receta) se ejecuta como una sola sentencia `UPDATE ... JOIN`: si la venta
dejaría algún insumo bajo cero, la restricción `CHECK` de la base de datos rechaza el `UPDATE` completo — ningún
insumo queda descontado a medias — y la API traduce ese error en un 422 legible (`src/utils/sqlErrors.js`).

## Estructura del proyecto

```
migrations/     esquema (001) y datos de prueba (002)
queries/        las 13 consultas SQL y su manifiesto de parámetros
src/
  config/       conexión a la base de datos (lee variables de entorno)
  docs/         spec de OpenAPI para Swagger UI (swagger.js)
  routes/       mapa de la API, con las anotaciones @swagger de cada endpoint
  controllers/  leen la petición, llaman al modelo y eligen la respuesta
  models/       consultas SQL parametrizadas
  middleware/   errores y rutas no encontradas
  utils/        validación, formato de respuestas y traducción de errores de MySQL (sqlErrors.js)
  views/        vacía por ahora (Etapa 2)
scripts/        migrar la base, ejecutar las consultas, exportar a RelaX, probar la API (api_check.js)
tests/          pruebas unitarias (npm test)
docs/           informe, diagramas, diccionario, álgebra relacional y resultados
```

## Despliegue (Render + Aiven)

1. **Base de datos:** crea un servicio MySQL en Aiven y anota host, puerto, usuario, clave y nombre de la base.
   Descarga su certificado CA.
2. **Cargar las tablas:** con las credenciales de Aiven en tu `.env` local (`DB_SSL=true` y `DB_SSL_CA` con la ruta al `.pem`),
   ejecuta `npm run db:reset`.
3. **Backend:** en Render crea un *Web Service* desde este repositorio con
   *Build Command* `npm install` y *Start Command* `npm start`.
4. **Variables de entorno en Render:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true` y
   `DB_SSL_CA_CONTENT` (el contenido del certificado). Render define `PORT` automáticamente.
5. Comprueba `https://<tu-servicio>.onrender.com/health`.

Los planes gratuitos pueden dormir el servicio o apagar la base por inactividad: despiértalos antes de una demostración.

## Documentación (`docs/`)

- `Grupo20-BrookiesCoffee-DefinicionProyecto.pdf`: informe de definición del proyecto (versión corregida)
- `modelo_er.png`, `modelo_relacional.png`, `diagrama_casos_uso.png`
- `diccionario_datos.md`
- `algebra_relacional.md` y `algebra_relacional/brookies.relax.txt` (grupo de datos para RelaX)
- `resultados_consultas.md`: resultado de ejecutar las 13 consultas
- `decisiones_tecnicas.md`
- `mockups/`: pantallas del sitio
