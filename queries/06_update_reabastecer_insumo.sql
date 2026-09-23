-- Consulta 06 | UPDATE  | RF14 - Reabastecer stock
-- Suma una cantidad al stock actual de un insumo.
-- Parámetros: cantidad a ingresar, id del insumo.
UPDATE insumo
SET stock_actual = stock_actual + ?
WHERE id_insumo = ?;
