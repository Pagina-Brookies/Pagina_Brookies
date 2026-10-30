-- Consulta 11 | DELETE  | RF12 - Editar receta de producto
-- Quita un insumo de la receta de un producto.
-- Parámetros: id del producto, id del insumo.
DELETE FROM receta
WHERE id_producto = ?
  AND id_insumo = ?;
