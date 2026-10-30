-- Consulta 01 | ALTER
-- Agrega un índice sobre producto.categoria. La categoría es un filtro
-- obligatorio de la consulta de productos (RNF04: responder en menos de 1 segundo).
-- No cambia las columnas del modelo, solo acelera la búsqueda.
ALTER TABLE producto
    ADD INDEX idx_producto_categoria (categoria);
