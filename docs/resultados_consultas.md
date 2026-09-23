# Resultados de las 13 consultas SQL

Generado con `npm run queries:md` sobre los datos de prueba (`migrations/002_seed.sql`).
Las consultas se ejecutan en orden y los cambios de cada una se ven en las siguientes.

## Consulta 01 · ALTER

Índice sobre producto.categoria.

Parámetros: `[]`

```sql
-- Consulta 01 | ALTER
-- Agrega un índice sobre producto.categoria. La categoría es un filtro
-- obligatorio de la consulta de productos (RNF04: responder en menos de 1 segundo).
-- No cambia las columnas del modelo, solo acelera la búsqueda.
ALTER TABLE producto
    ADD INDEX idx_producto_categoria (categoria);
```

Resultado: OK, filas afectadas: 0.

Verificación (consulta adicional, no cuenta entre las 13):

| indice | columna |
| --- | --- |
| idx_producto_categoria | categoria |

## Consulta 02 · ALTER

Columna fecha_respaldo en la tabla de respaldo.

Parámetros: `[]`

```sql
-- Consulta 02 | ALTER
-- Agrega a la tabla de respaldo la fecha en que se hizo la copia.
ALTER TABLE respaldo_insumo
    ADD COLUMN fecha_respaldo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

Resultado: OK, filas afectadas: 0.

Verificación (consulta adicional, no cuenta entre las 13):

| columna | tipo |
| --- | --- |
| id_insumo | int |
| nombre | varchar(100) |
| stock_actual | decimal(10,2) |
| fecha_respaldo | datetime |

## Consulta 03 · SELECT

Consulta de productos con filtros (categoría Café, caliente).

Parámetros: `["Café","caliente"]`

```sql
-- Consulta 03 | SELECT (sin JOIN)  | RF04 - Consulta de productos
-- Filtros obligatorios: categoría y disponibilidad (solo productos disponibles).
-- Filtro opcional: tipo de preparación. Orden: precio ascendente.
-- Parámetros: categoría, tipo de preparación.
SELECT id_producto, nombre, descripcion, precio, categoria, tipo_preparacion
FROM producto
WHERE categoria = ?
  AND disponible = TRUE
  AND tipo_preparacion = ?
ORDER BY precio ASC;
```

Resultado:

| id_producto | nombre | descripcion | precio | categoria | tipo_preparacion |
| --- | --- | --- | --- | --- | --- |
| 1 | Espresso | Shot de espresso | 1800 | Café | caliente |
| 2 | Americano | Espresso alargado con agua caliente | 2200 | Café | caliente |
| 3 | Latte | Espresso con leche entera texturizada | 2900 | Café | caliente |
| 4 | Cappuccino | Espresso con leche y espuma | 2900 | Café | caliente |
| 5 | Latte de avena | Espresso con leche de avena | 3200 | Café | caliente |

## Consulta 04 · SELECT

Productos más vendidos (JOIN + GROUP BY).

Parámetros: `[]`

```sql
-- Consulta 04 | SELECT (con JOIN y GROUP BY)  | Orden "más vendido" de la consulta de productos
-- Unidades vendidas por producto, sumando el detalle de todos los pedidos.
SELECT p.id_producto,
       p.nombre,
       SUM(d.cantidad) AS unidades_vendidas
FROM producto p
JOIN detalle_pedido d ON d.id_producto = p.id_producto
GROUP BY p.id_producto, p.nombre
ORDER BY unidades_vendidas DESC, p.nombre ASC;
```

Resultado:

| id_producto | nombre | unidades_vendidas |
| --- | --- | --- |
| 3 | Latte | 3 |
| 11 | Brookie clásico | 2 |
| 4 | Cappuccino | 2 |
| 1 | Espresso | 2 |
| 6 | Cold brew | 1 |
| 8 | Galleta de chocolate | 1 |
| 9 | Galleta vegana de avena | 1 |
| 7 | Té verde | 1 |

## Consulta 05 · SELECT

Insumos en stock crítico y productos que los usan (JOIN de 3 tablas).

Parámetros: `[]`

```sql
-- Consulta 05 | SELECT (con JOIN de 3 tablas)  | RF13 - Alerta de stock crítico
-- Insumos cuyo stock actual llegó a su mínimo (o está bajo él) y los productos
-- cuya receta los usa.
SELECT DISTINCT i.nombre        AS insumo,
                i.stock_actual,
                i.stock_minimo,
                p.nombre        AS producto
FROM insumo i
JOIN receta r   ON r.id_insumo   = i.id_insumo
JOIN producto p ON p.id_producto = r.id_producto
WHERE i.stock_actual <= i.stock_minimo
ORDER BY i.nombre, p.nombre;
```

Resultado:

| insumo | stock_actual | stock_minimo | producto |
| --- | --- | --- | --- |
| Huevos | 20 | 24 | Brookie clásico |
| Huevos | 20 | 24 | Galleta de chocolate |
| Huevos | 20 | 24 | Galleta sin gluten de almendras |
| Té verde en hebras | 90 | 100 | Té verde |

## Consulta 06 · UPDATE

Reabastecer 60 unidades de Huevos (id 7).

Parámetros: `[60,7]`

```sql
-- Consulta 06 | UPDATE  | RF14 - Reabastecer stock
-- Suma una cantidad al stock actual de un insumo.
-- Parámetros: cantidad a ingresar, id del insumo.
UPDATE insumo
SET stock_actual = stock_actual + ?
WHERE id_insumo = ?;
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| id_insumo | nombre | stock_actual | stock_minimo |
| --- | --- | --- | --- |
| 7 | Huevos | 80 | 24 |

## Consulta 07 · UPDATE

Descontar insumos de 2 Latte (id 3) según su receta.

Parámetros: `[2,3]`

```sql
-- Consulta 07 | UPDATE (con JOIN)  | RF10 - Descontar insumos según receta
-- Descuenta del inventario los insumos de la receta de un producto,
-- multiplicados por la cantidad vendida. Si algún insumo quedara bajo cero,
-- la restricción CHECK del stock rechaza la operación completa.
-- Parámetros: cantidad de unidades vendidas, id del producto.
UPDATE insumo i
JOIN receta r ON r.id_insumo = i.id_insumo
SET i.stock_actual = i.stock_actual - (r.cantidad_requerida * ?)
WHERE r.id_producto = ?;
```

Resultado: OK, filas afectadas: 2.

Verificación (consulta adicional, no cuenta entre las 13):

| id_insumo | nombre | stock_actual |
| --- | --- | --- |
| 1 | Café molido | 4468 |
| 2 | Leche entera | 8600 |

## Consulta 08 · INSERT

Registrar el insumo Sirope de caramelo.

Parámetros: `["Sirope de caramelo","ml",3000,500,0,0,0]`

```sql
-- Consulta 08 | INSERT  | RF11 - Registrar insumo
-- Parámetros: nombre, unidad de medida, stock actual, stock mínimo,
-- contiene gluten, contiene lactosa, es de origen animal.
INSERT INTO insumo
    (nombre, unidad_medida, stock_actual, stock_minimo,
     contiene_gluten, contiene_lactosa, es_origen_animal)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| id_insumo | nombre | unidad_medida | stock_actual | stock_minimo |
| --- | --- | --- | --- | --- |
| 13 | Sirope de caramelo | ml | 3000 | 500 |

## Consulta 09 · INSERT

Agregar el producto Caramel latte al menú.

Parámetros: `["Caramel latte","Latte con sirope de caramelo",3400,"Café","caliente",1]`

```sql
-- Consulta 09 | INSERT  | RF15 - Agregar producto al menú
-- Parámetros: nombre, descripción, precio, categoría, tipo de preparación, disponible.
INSERT INTO producto
    (nombre, descripcion, precio, categoria, tipo_preparacion, disponible)
VALUES (?, ?, ?, ?, ?, ?);
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| id_producto | nombre | precio | categoria | tipo_preparacion | disponible |
| --- | --- | --- | --- | --- | --- |
| 13 | Caramel latte | 3400 | Café | caliente | 1 |

## Consulta 10 · INSERT

Agregar 30 ml de Sirope de caramelo a la receta del Caramel latte.

Parámetros: `[30,"Sirope de caramelo","Caramel latte"]`

```sql
-- Consulta 10 | INSERT ... SELECT  | RF12 - Definir receta de producto
-- Agrega un insumo a la receta de un producto, buscando ambos por nombre.
-- Parámetros: cantidad requerida, nombre del insumo, nombre del producto.
INSERT INTO receta (id_producto, id_insumo, cantidad_requerida)
SELECT p.id_producto, i.id_insumo, ?
FROM producto p
JOIN insumo i ON i.nombre = ?
WHERE p.nombre = ?;
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| producto | insumo | cantidad_requerida |
| --- | --- | --- |
| Caramel latte | Sirope de caramelo | 30 |

## Consulta 11 · DELETE

Quitar el Azúcar (id 4) de la receta del Cold brew (id 6).

Parámetros: `[6,4]`

```sql
-- Consulta 11 | DELETE  | RF12 - Editar receta de producto
-- Quita un insumo de la receta de un producto.
-- Parámetros: id del producto, id del insumo.
DELETE FROM receta
WHERE id_producto = ?
  AND id_insumo = ?;
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| id_producto | id_insumo | cantidad_requerida |
| --- | --- | --- |
| 6 | 1 | 25 |

## Consulta 12 · DELETE

Eliminar el pedido de prueba 5 (CASCADE a detalle y pago).

Parámetros: `[5]`

```sql
-- Consulta 12 | DELETE con CASCADE
-- Elimina un pedido de prueba. Por ON DELETE CASCADE también se eliminan
-- sus líneas de detalle (detalle_pedido) y su pago (pago).
-- En el sistema real los pedidos no se eliminan: se conservan por trazabilidad.
-- Parámetro: id del pedido.
DELETE FROM pedido
WHERE id_pedido = ?;
```

Resultado: OK, filas afectadas: 1.

Verificación (consulta adicional, no cuenta entre las 13):

| pedidos | detalles | pagos |
| --- | --- | --- |
| 0 | 0 | 0 |

## Consulta 13 · DROP

Eliminar la tabla de respaldo temporal.

Parámetros: `[]`

```sql
-- Consulta 13 | DROP
-- Elimina la tabla de respaldo temporal creada en la preparación.
DROP TABLE respaldo_insumo;
```

Resultado: OK, filas afectadas: 0.

Verificación (consulta adicional, no cuenta entre las 13):

| tablas_existentes |
| --- |
| 0 |
