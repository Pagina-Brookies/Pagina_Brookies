# Diccionario de datos

Coincide con `migrations/001_schema.sql`. En MySQL los nombres de las tablas van en minúscula (por ejemplo `detalle_pedido`).

## USUARIO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_usuario | PK | INT | NOT NULL | AUTO_INCREMENT | — |
| nombre | — | VARCHAR(100) | NOT NULL | — | — |
| correo | — | VARCHAR(150) | NOT NULL | — | UNIQUE |
| contrasena_hash | — | VARCHAR(255) | NOT NULL | — | Hash de la contraseña; nunca se guarda en texto plano |
| fecha_registro | — | DATE | NOT NULL | Fecha actual | — |
| ultimo_acceso | — | DATETIME | NULL | — | — |
| activo | — | BOOLEAN | NOT NULL | TRUE | Soft delete: se desactiva en vez de eliminar |

## CLIENTE

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_usuario | PK, FK | INT | NOT NULL | — | FK -> USUARIO(id_usuario) |
| telefono | — | VARCHAR(20) | NULL | — | — |
| direccion | — | VARCHAR(200) | NULL | — | — |

## ADMINISTRADOR

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_usuario | PK, FK | INT | NOT NULL | — | FK -> USUARIO(id_usuario) |
| cargo | — | VARCHAR(50) | NOT NULL | — | — |
| fecha_asignacion | — | DATE | NOT NULL | — | — |

## PRODUCTO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_producto | PK | INT | NOT NULL | AUTO_INCREMENT | — |
| nombre | — | VARCHAR(100) | NOT NULL | — | — |
| descripcion | — | VARCHAR(300) | NULL | — | — |
| precio | — | DECIMAL(10,2) | NOT NULL | — | CHECK (precio > 0) |
| categoria | — | VARCHAR(50) | NOT NULL | — | — |
| tipo_preparacion | — | VARCHAR(20) | NOT NULL | 'no_aplica' | CHECK IN (caliente, frio, no_aplica). Las galletas usan no_aplica |
| disponible | — | BOOLEAN | NOT NULL | TRUE | Marca del administrador: el producto está en el menú. La disponibilidad efectiva exige además stock suficiente para su receta |

## INSUMO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_insumo | PK | INT | NOT NULL | AUTO_INCREMENT | — |
| nombre | — | VARCHAR(100) | NOT NULL | — | — |
| unidad_medida | — | VARCHAR(20) | NOT NULL | — | — |
| stock_actual | — | DECIMAL(10,2) | NOT NULL | 0 | CHECK (stock_actual >= 0) |
| stock_minimo | — | DECIMAL(10,2) | NOT NULL | — | CHECK (stock_minimo >= 0) |
| contiene_gluten | — | BOOLEAN | NOT NULL | FALSE | Base del filtro «sin gluten» |
| contiene_lactosa | — | BOOLEAN | NOT NULL | FALSE | Base del filtro «sin lactosa» |
| es_origen_animal | — | BOOLEAN | NOT NULL | FALSE | Base del filtro «vegano» |

## RECETA

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_producto | PK, FK | INT | NOT NULL | — | FK -> PRODUCTO(id_producto) |
| id_insumo | PK, FK | INT | NOT NULL | — | FK -> INSUMO(id_insumo) |
| cantidad_requerida | — | DECIMAL(10,2) | NOT NULL | — | CHECK (cantidad_requerida > 0) |

## PEDIDO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_pedido | PK | INT | NOT NULL | AUTO_INCREMENT | — |
| id_cliente | FK | INT | NOT NULL | — | FK -> CLIENTE(id_usuario) |
| fecha | — | DATETIME | NOT NULL | Fecha y hora actual | — |
| estado | — | VARCHAR(20) | NOT NULL | — | CHECK IN (recibido, en_preparacion, listo) |
| total | — | DECIMAL(10,2) | NOT NULL | — | CHECK (total >= 0) |

## DETALLE_PEDIDO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_pedido | PK, FK | INT | NOT NULL | — | FK -> PEDIDO(id_pedido) |
| id_producto | PK, FK | INT | NOT NULL | — | FK -> PRODUCTO(id_producto) |
| cantidad | — | INT | NOT NULL | — | CHECK (cantidad > 0) |
| precio_unitario | — | DECIMAL(10,2) | NOT NULL | — | CHECK (precio_unitario > 0) |

## PAGO

| Atributo | PK/FK | Tipo de dato | NULL / NOT NULL | Valor por defecto | Restricciones / Observaciones |
|---|---|---|---|---|---|
| id_pago | PK | INT | NOT NULL | AUTO_INCREMENT | — |
| id_pedido | FK | INT | NOT NULL | — | FK -> PEDIDO(id_pedido), UNIQUE |
| monto | — | DECIMAL(10,2) | NOT NULL | — | CHECK (monto > 0) |
| metodo_pago | — | VARCHAR(30) | NOT NULL | — | — |
| token_transaccion | — | VARCHAR(255) | NOT NULL | — | Token entregado por la pasarela; no se guardan datos de tarjeta |
| estado_pago | — | VARCHAR(20) | NOT NULL | — | CHECK IN (aprobado, rechazado, pendiente) |
| fecha_pago | — | DATETIME | NOT NULL | — | — |
