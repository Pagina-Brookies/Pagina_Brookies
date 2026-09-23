-- Consulta 02 | ALTER
-- Agrega a la tabla de respaldo la fecha en que se hizo la copia.
ALTER TABLE respaldo_insumo
    ADD COLUMN fecha_respaldo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
