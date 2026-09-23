-- Consulta 09 | INSERT  | RF15 - Agregar producto al menú
-- Parámetros: nombre, descripción, precio, categoría, tipo de preparación, disponible.
INSERT INTO producto
    (nombre, descripcion, precio, categoria, tipo_preparacion, disponible)
VALUES (?, ?, ?, ?, ?, ?);
