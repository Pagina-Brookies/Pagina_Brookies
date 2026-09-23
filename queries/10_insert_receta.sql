-- Consulta 10 | INSERT ... SELECT  | RF12 - Definir receta de producto
-- Agrega un insumo a la receta de un producto, buscando ambos por nombre.
-- Parámetros: cantidad requerida, nombre del insumo, nombre del producto.
INSERT INTO receta (id_producto, id_insumo, cantidad_requerida)
SELECT p.id_producto, i.id_insumo, ?
FROM producto p
JOIN insumo i ON i.nombre = ?
WHERE p.nombre = ?;
