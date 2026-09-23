# Decisiones técnicas

Resumen de lo que se decidió para la Etapa 1 y por qué. Sirve como apoyo para explicar el trabajo.

## Stack

| Decisión | Elección | Razón |
|---|---|---|
| Backend | Node.js + Express | El equipo ya tiene experiencia con Express; sirve también para la API REST y su documentación (Etapa 2) y para JWT (Etapa 3). |
| Base de datos | MySQL 8 | El diccionario de datos usa `AUTO_INCREMENT`, `DECIMAL` y restricciones `CHECK`, que MySQL 8.0.16+ aplica. |
| Acceso a datos | Driver `mysql2` con SQL parametrizado, sin ORM | Las 13 consultas deben verse como SQL y traducirse a álgebra relacional. Los valores del usuario van siempre como parámetros (`?`). |
| Hosting del backend | Render | Despliegue simple desde GitHub. |
| Hosting de la BD | Aiven (MySQL) | Render no aloja MySQL. Aiven exige conexión SSL (ver `.env.example`). |

Los planes gratuitos pueden dormir el servicio o apagar la base por inactividad: antes de una demostración hay que
despertar ambos y confirmar `GET /health`.

## Ajustes al modelo (respecto de la primera versión del informe)

- `INSUMO`: tres booleanos (`contiene_gluten`, `contiene_lactosa`, `es_origen_animal`), base del filtro "apto para".
- `PRODUCTO`: `tipo_preparacion` (`caliente`, `frio`, `no_aplica`). Las galletas usan `no_aplica`.
- Disponibilidad: `producto.disponible` es la marca del administrador. La disponibilidad efectiva se calcula:
  `disponible = TRUE` y stock suficiente de cada insumo de la receta (ver `src/models/producto.model.js`).
- Identificadores sin ñ ni acentos: `contrasena_hash`, `en_preparacion`.

## Arquitectura (clase 03)

- **Capas:** rutas → controladores → modelos → base de datos. Los controladores no contienen SQL y los modelos no leen la petición.
- **REST:** recursos en plural en la URL (`/api/v1/products`), acción en el método HTTP, código de estado correcto (200, 400, 404, 500, 503).
- **Respuesta uniforme:** `{ "data": ..., "errors": [] }` tanto en éxito como en error.
- **Validación en el servidor** antes de tocar la base (`src/utils/validators.js`).
- **Seguridad:** consultas parametrizadas, secretos en variables de entorno (`.env` fuera del repositorio), mensaje genérico al usuario y detalle en el registro.

## Consultas de las Etapas siguientes

La confirmación de pedidos (transacción atómica que relaciona pedido, detalle, pago e insumos) y la autenticación con JWT
quedan para las Etapas 2 y 3. La consulta 07 (`UPDATE` con JOIN) ya implementa el descuento de insumos según receta.
