-- =====================================================================
-- Brookies Coffee - Datos de prueba
-- Datos ficticios para desarrollo y demostración. No son datos reales.
-- Todos los usuarios de prueba tienen la contraseña "demo1234"
-- (guardada como hash bcrypt, nunca en texto plano).
-- =====================================================================

-- Usuarios: 1 administrador y 3 clientes
INSERT INTO usuario (id_usuario, nombre, correo, contrasena_hash, fecha_registro, ultimo_acceso, activo) VALUES
(1, 'Administrador Brookies', 'admin@brookies.example',  '$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C', '2026-08-01', '2026-09-19 09:00:00', TRUE),
(2, 'Camila Rojas',           'camila.rojas@example.com', '$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C', '2026-08-10', '2026-09-18 12:05:00', TRUE),
(3, 'Diego Pérez',            'diego.perez@example.com',  '$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C', '2026-08-12', '2026-09-19 10:55:00', TRUE),
(4, 'Valentina Soto',         'valentina.soto@example.com', '$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C', '2026-08-20', '2026-09-17 09:35:00', TRUE);

INSERT INTO administrador (id_usuario, cargo, fecha_asignacion) VALUES
(1, 'Dueño', '2026-08-01');

INSERT INTO cliente (id_usuario, telefono, direccion) VALUES
(2, '+56 9 1111 1111', 'Calle Ejemplo 123, Valparaíso'),
(3, '+56 9 2222 2222', 'Pasaje Ficticio 45, Viña del Mar'),
(4, '+56 9 3333 3333', NULL);

-- Insumos (Huevos y Té verde parten bajo su stock mínimo, para probar la alerta de stock crítico)
INSERT INTO insumo (id_insumo, nombre, unidad_medida, stock_actual, stock_minimo, contiene_gluten, contiene_lactosa, es_origen_animal) VALUES
(1,  'Café molido',         'g',      4500.00, 1000.00, FALSE, FALSE, FALSE),
(2,  'Leche entera',        'ml',     9000.00, 3000.00, FALSE, TRUE,  TRUE),
(3,  'Leche de avena',      'ml',     5000.00, 1500.00, TRUE,  FALSE, FALSE),
(4,  'Azúcar',              'g',      7000.00, 1500.00, FALSE, FALSE, FALSE),
(5,  'Harina de trigo',     'g',      9000.00, 2000.00, TRUE,  FALSE, FALSE),
(6,  'Mantequilla',         'g',      2400.00,  800.00, FALSE, TRUE,  TRUE),
(7,  'Huevos',              'unidad',   20.00,   24.00, FALSE, FALSE, TRUE),
(8,  'Chips de chocolate',  'g',      2200.00,  500.00, FALSE, FALSE, FALSE),
(9,  'Té verde en hebras',  'g',        90.00,  100.00, FALSE, FALSE, FALSE),
(10, 'Harina de almendras', 'g',      1500.00,  400.00, FALSE, FALSE, FALSE),
(11, 'Aceite vegetal',      'ml',     1800.00,  500.00, FALSE, FALSE, FALSE),
(12, 'Avena en hojuelas',   'g',      2500.00,  500.00, TRUE,  FALSE, FALSE);

-- Menú
INSERT INTO producto (id_producto, nombre, descripcion, precio, categoria, tipo_preparacion, disponible) VALUES
(1,  'Espresso',                      'Shot de espresso',                          1800.00, 'Café',    'caliente',  TRUE),
(2,  'Americano',                     'Espresso alargado con agua caliente',       2200.00, 'Café',    'caliente',  TRUE),
(3,  'Latte',                         'Espresso con leche entera texturizada',     2900.00, 'Café',    'caliente',  TRUE),
(4,  'Cappuccino',                    'Espresso con leche y espuma',               2900.00, 'Café',    'caliente',  TRUE),
(5,  'Latte de avena',                'Espresso con leche de avena',               3200.00, 'Café',    'caliente',  TRUE),
(6,  'Cold brew',                     'Café de extracción en frío con hielo',     3300.00, 'Café',    'frio',      TRUE),
(7,  'Té verde',                      'Infusión de té verde',                      2000.00, 'Té',      'caliente',  TRUE),
(8,  'Galleta de chocolate',          'Galleta con chips de chocolate',            1900.00, 'Galleta', 'no_aplica', TRUE),
(9,  'Galleta vegana de avena',       'Galleta de avena sin huevo ni lácteos',     2100.00, 'Galleta', 'no_aplica', TRUE),
(10, 'Galleta sin gluten de almendras', 'Galleta de harina de almendras',          2300.00, 'Galleta', 'no_aplica', TRUE),
(11, 'Brookie clásico',               'Mezcla de brownie y galleta',               2600.00, 'Galleta', 'no_aplica', TRUE),
(12, 'Brookie de temporada',          'Retirado del menú por ahora',               2800.00, 'Galleta', 'no_aplica', FALSE);

-- Recetas (cantidades por unidad de producto)
INSERT INTO receta (id_producto, id_insumo, cantidad_requerida) VALUES
(1, 1, 16.00),
(2, 1, 16.00),
(3, 1, 16.00), (3, 2, 200.00),
(4, 1, 16.00), (4, 2, 120.00),
(5, 1, 16.00), (5, 3, 200.00),
(6, 1, 25.00), (6, 4, 5.00),
(7, 9, 3.00),  (7, 4, 5.00),
(8, 5, 60.00), (8, 6, 40.00), (8, 4, 35.00), (8, 7, 0.50), (8, 8, 30.00),
(9, 5, 50.00), (9, 11, 30.00), (9, 4, 35.00), (9, 12, 40.00), (9, 8, 20.00),
(10, 10, 60.00), (10, 4, 30.00), (10, 7, 0.50),
(11, 5, 70.00), (11, 6, 60.00), (11, 4, 50.00), (11, 7, 1.00), (11, 8, 50.00);

-- Pedidos (el pedido 5 es un pedido de prueba: la consulta 12 lo elimina)
INSERT INTO pedido (id_pedido, id_cliente, fecha, estado, total) VALUES
(1, 2, '2026-09-14 10:05:00', 'listo',          7700.00),
(2, 3, '2026-09-15 16:20:00', 'listo',          8500.00),
(3, 4, '2026-09-17 09:40:00', 'en_preparacion', 7900.00),
(4, 2, '2026-09-18 12:10:00', 'recibido',       6700.00),
(5, 3, '2026-09-19 11:00:00', 'recibido',       1800.00);

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
(1, 3, 2, 2900.00), (1, 8, 1, 1900.00),
(2, 6, 1, 3300.00), (2, 11, 2, 2600.00),
(3, 4, 2, 2900.00), (3, 9, 1, 2100.00),
(4, 1, 1, 1800.00), (4, 7, 1, 2000.00), (4, 3, 1, 2900.00),
(5, 1, 1, 1800.00);

-- Pagos (los tokens son ficticios; el sistema nunca guarda datos de tarjeta)
INSERT INTO pago (id_pago, id_pedido, monto, metodo_pago, token_transaccion, estado_pago, fecha_pago) VALUES
(1, 1, 7700.00, 'tarjeta', 'tok_demo_0001', 'aprobado', '2026-09-14 10:05:40'),
(2, 2, 8500.00, 'tarjeta', 'tok_demo_0002', 'aprobado', '2026-09-15 16:20:35'),
(3, 3, 7900.00, 'tarjeta', 'tok_demo_0003', 'aprobado', '2026-09-17 09:40:50'),
(4, 4, 6700.00, 'tarjeta', 'tok_demo_0004', 'aprobado', '2026-09-18 12:10:42'),
(5, 5, 1800.00, 'tarjeta', 'tok_demo_0005', 'aprobado', '2026-09-19 11:00:31');
