-- PREPARACIÓN (no cuenta entre las 13 consultas)
-- Crea una tabla de respaldo temporal de los insumos. Se usa en las consultas
-- 02 (ALTER) y 13 (DROP), para no modificar ni eliminar tablas del modelo real.
-- Lleva llave primaria porque algunos servicios en la nube (como Aiven) la exigen en toda tabla.
CREATE TABLE respaldo_insumo (
    id_insumo     INT           NOT NULL PRIMARY KEY,
    nombre        VARCHAR(100)  NOT NULL,
    stock_actual  DECIMAL(10,2) NOT NULL
) AS
SELECT id_insumo, nombre, stock_actual
FROM insumo;
