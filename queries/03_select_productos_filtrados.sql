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
