-- Consulta 07 | UPDATE (con JOIN)  | RF10 - Descontar insumos según receta
-- Descuenta del inventario los insumos de la receta de un producto,
-- multiplicados por la cantidad vendida. Si algún insumo quedara bajo cero,
-- la restricción CHECK del stock rechaza la operación completa.
-- Parámetros: cantidad de unidades vendidas, id del producto.
UPDATE insumo i
JOIN receta r ON r.id_insumo = i.id_insumo
SET i.stock_actual = i.stock_actual - (r.cantidad_requerida * ?)
WHERE r.id_producto = ?;
