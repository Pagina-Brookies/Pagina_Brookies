-- Consulta 08 | INSERT  | RF11 - Registrar insumo
-- Parámetros: nombre, unidad de medida, stock actual, stock mínimo,
-- contiene gluten, contiene lactosa, es de origen animal.
INSERT INTO insumo
    (nombre, unidad_medida, stock_actual, stock_minimo,
     contiene_gluten, contiene_lactosa, es_origen_animal)
VALUES (?, ?, ?, ?, ?, ?, ?);
