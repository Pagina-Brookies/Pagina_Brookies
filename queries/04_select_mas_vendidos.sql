-- Consulta 04 | SELECT (con JOIN y GROUP BY)  | Orden "más vendido" de la consulta de productos
-- Unidades vendidas por producto, sumando el detalle de todos los pedidos.
SELECT p.id_producto,
       p.nombre,
       SUM(d.cantidad) AS unidades_vendidas
FROM producto p
JOIN detalle_pedido d ON d.id_producto = p.id_producto
GROUP BY p.id_producto, p.nombre
ORDER BY unidades_vendidas DESC, p.nombre ASC;
