-- Consulta 12 | DELETE con CASCADE
-- Elimina un pedido de prueba. Por ON DELETE CASCADE también se eliminan
-- sus líneas de detalle (detalle_pedido) y su pago (pago).
-- En el sistema real los pedidos no se eliminan: se conservan por trazabilidad.
-- Parámetro: id del pedido.
DELETE FROM pedido
WHERE id_pedido = ?;
