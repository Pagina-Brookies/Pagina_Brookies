-- =====================================================================
-- Brookies Coffee - Esquema de la base de datos (MySQL 8.0.16 o superior)
-- Grupo 20 - ICI-324 Bases de Datos y Programación Web
--
-- Implementa el modelo relacional y el diccionario de datos del informe.
-- Los nombres de tablas van en minúscula (MySQL en Linux distingue
-- mayúsculas y minúsculas): USUARIO -> usuario, DETALLE_PEDIDO -> detalle_pedido.
-- Las restricciones CHECK se aplican desde MySQL 8.0.16.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Usuarios (especialización: cada usuario es cliente o administrador)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario      INT           NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(100)  NOT NULL,
    correo          VARCHAR(150)  NOT NULL,
    contrasena_hash VARCHAR(255)  NOT NULL,
    fecha_registro  DATE          NOT NULL DEFAULT (CURRENT_DATE),
    ultimo_acceso   DATETIME      NULL,
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_correo UNIQUE (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cliente (
    id_usuario  INT          NOT NULL,
    telefono    VARCHAR(20)  NULL,
    direccion   VARCHAR(200) NULL,
    PRIMARY KEY (id_usuario),
    CONSTRAINT fk_cliente_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE administrador (
    id_usuario        INT         NOT NULL,
    cargo             VARCHAR(50) NOT NULL,
    fecha_asignacion  DATE        NOT NULL,
    PRIMARY KEY (id_usuario),
    CONSTRAINT fk_administrador_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Menú e inventario
-- ---------------------------------------------------------------------
CREATE TABLE producto (
    id_producto       INT           NOT NULL AUTO_INCREMENT,
    nombre            VARCHAR(100)  NOT NULL,
    descripcion       VARCHAR(300)  NULL,
    precio            DECIMAL(10,2) NOT NULL,
    categoria         VARCHAR(50)   NOT NULL,
    tipo_preparacion  VARCHAR(20)   NOT NULL DEFAULT 'no_aplica',
    disponible        BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_producto),
    CONSTRAINT ck_producto_precio CHECK (precio > 0),
    CONSTRAINT ck_producto_tipo_preparacion
        CHECK (tipo_preparacion IN ('caliente', 'frio', 'no_aplica'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE insumo (
    id_insumo         INT           NOT NULL AUTO_INCREMENT,
    nombre            VARCHAR(100)  NOT NULL,
    unidad_medida     VARCHAR(20)   NOT NULL,
    stock_actual      DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_minimo      DECIMAL(10,2) NOT NULL,
    contiene_gluten   BOOLEAN       NOT NULL DEFAULT FALSE,
    contiene_lactosa  BOOLEAN       NOT NULL DEFAULT FALSE,
    es_origen_animal  BOOLEAN       NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_insumo),
    CONSTRAINT ck_insumo_stock_actual CHECK (stock_actual >= 0),
    CONSTRAINT ck_insumo_stock_minimo CHECK (stock_minimo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receta (
    id_producto         INT           NOT NULL,
    id_insumo           INT           NOT NULL,
    cantidad_requerida  DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_producto, id_insumo),
    CONSTRAINT ck_receta_cantidad CHECK (cantidad_requerida > 0),
    CONSTRAINT fk_receta_producto
        FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_receta_insumo
        FOREIGN KEY (id_insumo) REFERENCES insumo (id_insumo)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------
-- Pedidos y pagos
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido   INT           NOT NULL AUTO_INCREMENT,
    id_cliente  INT           NOT NULL,
    fecha       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado      VARCHAR(20)   NOT NULL,
    total       DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pedido),
    CONSTRAINT ck_pedido_estado CHECK (estado IN ('recibido', 'en_preparacion', 'listo')),
    CONSTRAINT ck_pedido_total CHECK (total >= 0),
    CONSTRAINT fk_pedido_cliente
        FOREIGN KEY (id_cliente) REFERENCES cliente (id_usuario)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE detalle_pedido (
    id_pedido        INT           NOT NULL,
    id_producto      INT           NOT NULL,
    cantidad         INT           NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pedido, id_producto),
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_detalle_precio CHECK (precio_unitario > 0),
    CONSTRAINT fk_detalle_pedido
        FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pago (
    id_pago            INT           NOT NULL AUTO_INCREMENT,
    id_pedido          INT           NOT NULL,
    monto              DECIMAL(10,2) NOT NULL,
    metodo_pago        VARCHAR(30)   NOT NULL,
    token_transaccion  VARCHAR(255)  NOT NULL,
    estado_pago        VARCHAR(20)   NOT NULL,
    fecha_pago         DATETIME      NOT NULL,
    PRIMARY KEY (id_pago),
    CONSTRAINT uq_pago_pedido UNIQUE (id_pedido),
    CONSTRAINT ck_pago_monto CHECK (monto > 0),
    CONSTRAINT ck_pago_estado CHECK (estado_pago IN ('aprobado', 'rechazado', 'pendiente')),
    CONSTRAINT fk_pago_pedido
        FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
