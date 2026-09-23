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
