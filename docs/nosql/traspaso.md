# Traspaso del modelo relacional a MongoDB

Brookies Coffee · Grupo 20 · ICI-324. Se sigue la receta de 5 pasos de la clase de NoSQL:
inventario → consultas → decisión → colecciones → validación.

**Resultado:** 9 tablas relacionales pasan a **4 colecciones**: `usuarios`, `productos`, `insumos` y `pedidos`.
Se agrega una quinta, `reservas`, que no viene del relacional: guarda el stock apartado mientras el cliente paga.
Los documentos de ejemplo están en `docs/nosql/json/` (un archivo por colección).

---

## Paso 1 · Inventario de tablas y relaciones

| Relación | Cardinalidad | Nota |
|---|---|---|
| usuario → cliente / administrador | 1:1 (especialización total y exclusiva) | Todo usuario es cliente o administrador, nunca ambos |
| producto ↔ insumo (tabla `receta`) | N:M con atributo `cantidad_requerida` | Un producto usa pocos insumos (2 a 5 en los datos de prueba) |
| cliente → pedido | 1:N | El historial crece sin límite |
| pedido → detalle_pedido | 1:N (pocos ítems) | Atributos propios: `cantidad`, `precio_unitario` |
| detalle_pedido → producto | N:1 | |
| pedido → pago | 1:1 | `UNIQUE (id_pedido)` en el relacional |

## Paso 2 · Consultas principales de la aplicación

| N° | Consulta | Frecuencia | Origen (SQL / RF) |
|---|---|---|---|
| Q1 | Menú con filtros: categoría, disponibilidad, apto para, tipo de preparación, orden por precio o más vendido | Muy frecuente (cada visita) | Consulta 03 · RF04 |
| Q2 | Reservar stock al ir a pagar y descontarlo cuando el pago se aprueba | Frecuente (cada venta) | Consulta 07 · RF07, RF10 |
| Q3 | Historial de pedidos de un cliente | Frecuente | RF08 |
| Q4 | Insumos en stock crítico y los productos que los usan | Diaria (administrador) | Consulta 05 · RF13 |
| Q5 | Productos más vendidos | Ocasional (reportes) | Consulta 04 · RF16 |

## Paso 3 · Una decisión por relación

Criterios: ¿se lee junto? ¿cuánto crece? ¿cambia seguido? (guía de la clase).

| Relación | ¿Se lee junto? | ¿Crece sin límite? | ¿Cambia seguido? | Decisión | Alternativa descartada y por qué |
|---|---|---|---|---|---|
| usuario → cliente / administrador | Sí (login y perfil) | No | No | **Una sola colección `usuarios`** con campo `rol` y un subdocumento `cliente` o `administrador` | Tres colecciones (una por tabla): copia el relacional y obliga a la aplicación a cuidar que un usuario no esté en dos tablas. Con un documento y un `rol`, la exclusividad y la totalidad quedan garantizadas por la estructura |
| producto ↔ insumo (receta) | Sí (Q1 "apto para", Q2 validar stock) | No (2 a 5 ítems) | La cantidad casi nunca | **Arreglo `receta` embebido en `productos`** con `{insumo_id, nombre, unidad_medida, cantidad_requerida}` (referencia extendida) | Colección `recetas` aparte: cada venta y cada filtro necesitaría `$lookup`. Embeber el insumo completo: copiaría `stock_actual`, que cambia en cada venta |
| insumo | No se muestra dentro del producto | No | **Sí** (`stock_actual` en cada venta y reabastecimiento) | **Colección `insumos` propia**, una sola copia del stock | Copiar el stock dentro de la receta: quedaría desactualizado o habría que reescribirlo en muchos productos |
| pedido → detalle_pedido | Sí, siempre | No (pocos ítems) | No (es historial) | **Arreglo `items` embebido en `pedidos`** | Colección `detalle_pedido`: cada historial sería un `$lookup` |
| detalle → producto | Se muestra el nombre y el precio de ese día | No | El precio del producto sí cambia | **Copiar `nombre` y `precio_unitario`** en el ítem (foto histórica) | Solo referenciar: si sube el precio, cambiarían los pedidos pasados |
| cliente → pedidos | Solo en Q3 | **Sí** | No | **No embeber.** `pedidos` es colección propia con referencia extendida `cliente: {_id, nombre}` | Arreglo de pedidos dentro del cliente: crece sin límite y se acerca a los 16 MB |
| pedido → pago | Sí | No (1:1) | No | **Subdocumento `pago` embebido** en `pedidos` | Colección `pagos`: el pago nace y se lee siempre con su pedido |

### Dos duplicaciones que hay que poder defender

1. **`apto_para` en `productos`** (por ejemplo `["sin_lactosa", "vegano"]`). Hoy la API lo calcula en cada consulta
   con un `NOT EXISTS` sobre los insumos de la receta. Se guarda precalculado porque Q1 es la consulta más
   frecuente y el dato casi no cambia. **Costo:** si cambia una marca de un insumo (`contiene_gluten`,
   `contiene_lactosa`, `es_origen_animal`) o la receta, hay que recalcular los productos que lo usan.
2. **`nombre` y `unidad_medida` dentro de la receta.** Se leen siempre con el producto y casi no cambian.
   **Costo:** si se renombra un insumo, hay que hacer `updateMany` sobre `productos`.

### Lo que NO se duplica: la disponibilidad efectiva

`disponible` es la marca del administrador. La disponibilidad efectiva (marca + stock suficiente en cada insumo
de la receta) **se calcula al consultar**, porque depende de `stock_actual`, que cambia en cada venta.
Alternativa descartada: guardar un `disponible` precalculado. Obligaría a reescribir los productos en cada venta y
cada reabastecimiento. Con un solo local el volumen es bajo, así que se aplica KISS/YAGNI. Si el menú se pusiera
lento, es la primera optimización a considerar (medir antes).

## Paso 4 · Colecciones resultantes

| Tabla relacional | Destino | Por qué |
|---|---|---|
| `usuario` + `cliente` + `administrador` | colección **`usuarios`** | Entidad principal de login y perfil; la especialización se resuelve con `rol` |
| `producto` + `receta` | colección **`productos`** (con `receta[]` embebido) | Entidad principal de Q1; la receta se lee con el producto |
| `insumo` | colección **`insumos`** | El stock cambia seguido; Q4 y Q2 lo consultan por separado |
| (nueva) | colección **`reservas`** | Stock apartado durante el pago, con vencimiento (Q2) |
| `pedido` + `detalle_pedido` + `pago` | colección **`pedidos`** (con `items[]` y `pago` embebidos) | Q3 y Q5; un pedido se lee completo de una vez |

Tipos de datos usados (ver `json/`):

- `_id`: entero, el mismo `id_*` del relacional. Mantiene la trazabilidad de la migración. Alternativa descartada:
  `ObjectId` generado por MongoDB. Es lo habitual, pero con un solo local no aporta y perdería la correspondencia con las tablas.
- Fechas: Extended JSON `{"$date": "..."}` en UTC (en septiembre, Chile está en UTC-3).
- Precios y stock: números. Los precios se manejan como pesos enteros (CLP no tiene decimales).
  Si algún insumo necesitara decimales exactos, se usaría `Decimal128`.
- Arreglos: `apto_para`, `receta` e `items`. Objetos embebidos: `cliente`, `administrador`, `pago`.

Importar a una base de prueba:

```bash
mongoimport --db brookies --collection usuarios  --jsonArray --file docs/nosql/json/usuarios.json
mongoimport --db brookies --collection productos --jsonArray --file docs/nosql/json/productos.json
mongoimport --db brookies --collection insumos   --jsonArray --file docs/nosql/json/insumos.json
mongoimport --db brookies --collection pedidos   --jsonArray --file docs/nosql/json/pedidos.json
```

## Paso 5 · Consultas en MQL e índices

> **Pruebas:** `docs/nosql/pruebas.mongosh.js` carga los datos del seed en una base `brookies_pruebas`, corre Q1 a Q5,
> los índices y la transacción, imprime OK/FALLA y borra la base. Uso: `mongosh "<cadena de Atlas>" --file docs/nosql/pruebas.mongosh.js`.
> **Resultado:** ejecutado en MongoDB Atlas (cluster M0) el 19-10-2026, 17 de 17 pruebas OK (Q1 a Q5, índice único, transacción y reservas).

**Q1 · Menú con filtros** (equivale a la consulta 03, más "apto para")

```js
db.productos.find(
  { categoria: "Café", disponible: true, tipo_preparacion: "caliente", apto_para: "vegano" },
  { nombre: 1, descripcion: 1, precio: 1, categoria: 1, tipo_preparacion: 1, apto_para: 1 }
).sort({ precio: 1 })
```

Con disponibilidad efectiva (aquí sí hace falta `$lookup`, es el costo asumido). Se "desarma" la receta, se cruza cada
ítem con su insumo y se cuentan los insumos que no alcanzan:

```js
db.productos.aggregate([
  { $match: { disponible: true, categoria: "Café" } },
  { $unwind: "$receta" },                 // un producto sin receta desaparece aquí: nunca sale como disponible
  { $lookup: { from: "insumos", localField: "receta.insumo_id", foreignField: "_id", as: "insumo" } },
  { $unwind: "$insumo" },
  { $group: { _id: "$_id", nombre: { $first: "$nombre" }, precio: { $first: "$precio" }, apto_para: { $first: "$apto_para" },
              insumos_sin_stock: { $sum: { $cond: [{ $lt: ["$insumo.stock_actual", "$receta.cantidad_requerida"] }, 1, 0] } } } },
  { $match: { insumos_sin_stock: 0 } },
  { $sort: { precio: 1 } }
])
```

Alternativa descartada: `$allElementsTrue` sobre un `$map` de la receta. Es más corta, pero con una receta vacía
devuelve `true` y el producto saldría disponible.

**Q2 · Reservar, pagar y descontar** (reemplaza la consulta 07). Funciona como la compra de asientos en un cine:
al pasar a Webpay el stock queda apartado por 10 minutos; si el pago se aprueba se descuenta, y si se rechaza o
vence, se libera. Así el stock no puede acabarse entre que el cliente confirma el carrito y que Webpay aprueba.

Cada insumo lleva `stock_reservado`, y lo que se puede vender es `stock_actual - stock_reservado`. Cada paso es una
**transacción multi-documento** (requiere replica set; Atlas lo es), porque toca varios insumos y debe ser todo o nada.

```js
// 1) Reservar al pasar a Webpay
session.withTransaction(() => {
  const s = session.getDatabase("brookies");
  liberarVencidas(s);                                   // paso 3, antes de reservar
  const necesita = [];                                  // [{insumo_id, cantidad}] = receta x cantidad de cada ítem
  for (const it of carrito) for (const r of s.productos.findOne({ _id: it.producto_id }).receta)
    necesita.push({ insumo_id: r.insumo_id, cantidad: r.cantidad_requerida * it.cantidad });
  for (const n of necesita) {
    const res = s.insumos.updateOne(
      { _id: n.insumo_id, $expr: { $gte: [{ $subtract: ["$stock_actual", "$stock_reservado"] }, n.cantidad] } },
      { $inc: { stock_reservado: n.cantidad } });
    if (res.modifiedCount === 0) throw new Error("Stock insuficiente");   // pantalla 08
  }
  s.reservas.insertOne({ _id: idReserva, cliente: { _id: 2, nombre: "Ignacia Valdebenito" }, items: carrito,
                         insumos: necesita, estado: "activa", expira_en: new Date(Date.now() + 10 * 60 * 1000) });
});

// 2) Webpay aprueba: se descuenta lo reservado y se crea el pedido
session.withTransaction(() => {
  const s = session.getDatabase("brookies");
  const r = s.reservas.findOneAndUpdate({ _id: idReserva, estado: "activa", expira_en: { $gt: new Date() } },
                                        { $set: { estado: "pagada" } });
  if (!r) throw new Error("Reserva vencida: anular el cobro en Webpay");
  for (const n of r.insumos)
    s.insumos.updateOne({ _id: n.insumo_id }, { $inc: { stock_actual: -n.cantidad, stock_reservado: -n.cantidad } });
  s.pedidos.insertOne({ /* items, total, cliente y pago aprobado */ });
});

// 3) Pago rechazado o reserva vencida: se devuelve lo apartado
function liberarVencidas(s) {
  for (const r of s.reservas.find({ estado: "activa", expira_en: { $lte: new Date() } }).toArray()) {
    for (const n of r.insumos) s.insumos.updateOne({ _id: n.insumo_id }, { $inc: { stock_reservado: -n.cantidad } });
    s.reservas.updateOne({ _id: r._id }, { $set: { estado: "liberada" } });
  }
}
```

Decisiones de este flujo:

- **Contador `stock_reservado` en el insumo**, no calcularlo sumando las reservas activas. Con el contador, la
  verificación y el apartado son un solo `updateOne` condicional, así dos clientes no pueden reservar el último stock a la vez.
  Alternativa descartada: índice TTL que borra las reservas vencidas solo. Es más simple, pero entonces el stock
  disponible se calcula con un `$lookup` en cada consulta y la verificación deja de ser atómica.
- **Las reservas vencidas se liberan al hacer una reserva nueva** (y se puede agregar una tarea periódica). No se
  depende de un proceso siempre encendido, porque Render gratis duerme el servidor.
- **10 minutos de reserva:** debe ser mayor que lo que tarda un pago en Webpay. Si aun así un pago llega con la
  reserva vencida, el paso 2 falla y se anula el cobro. Es el único caso raro y queda cubierto.
- **Alternativa descartada: descontar recién al aprobar el pago**, sin reservar. Es más simple, pero el stock puede
  acabarse mientras el cliente paga, y entonces hay que devolverle el dinero.

**Q3 · Historial de pedidos de un cliente**

```js
db.pedidos.find({ "cliente._id": 2 }).sort({ fecha: -1 })
```

**Q4 · Insumos en stock crítico y sus productos** (equivale a la consulta 05; el JOIN de 3 tablas pasa a un `$lookup`)

```js
db.insumos.aggregate([
  { $match: { $expr: { $lte: ["$stock_actual", "$stock_minimo"] } } },
  { $lookup: { from: "productos", localField: "_id", foreignField: "receta.insumo_id", as: "productos" } },
  { $project: { nombre: 1, stock_actual: 1, stock_minimo: 1, "productos.nombre": 1 } },
  { $sort: { nombre: 1 } }
])
```

**Q5 · Más vendidos** (equivale a la consulta 04)

```js
db.pedidos.aggregate([
  { $unwind: "$items" },
  { $group: { _id: "$items.producto_id", nombre: { $first: "$items.nombre" }, unidades_vendidas: { $sum: "$items.cantidad" } } },
  { $sort: { unidades_vendidas: -1, nombre: 1 } }
])
```

**Índices (uno por consulta frecuente):**

```js
db.usuarios.createIndex({ correo: 1 }, { unique: true })              // login
db.productos.createIndex({ nombre: 1 }, { unique: true })             // nombres sin repetir
db.insumos.createIndex({ nombre: 1 }, { unique: true })               // nombres sin repetir
db.productos.createIndex({ categoria: 1, disponible: 1, precio: 1 })  // Q1
db.productos.createIndex({ apto_para: 1 })                            // Q1 (filtro apto para)
db.productos.createIndex({ "receta.insumo_id": 1 })                   // Q4
db.pedidos.createIndex({ "cliente._id": 1, fecha: -1 })               // Q3
db.reservas.createIndex({ estado: 1, expira_en: 1 })                  // Q2: buscar reservas vencidas
```

`insumos` es una colección pequeña: Q4 compara dos campos entre sí (`$expr`) y ningún índice ayudaría. `pedidos` no necesita
índice para Q5, que es un reporte ocasional.

---

## Cambios hipotéticos (para la defensa)

| Si pasa esto… | Qué ocurre con este diseño |
|---|---|
| El cliente abandona el pago en Webpay | Su reserva vence a los 10 minutos y el stock apartado vuelve a estar disponible en la siguiente reserva |
| Dos clientes quieren el último stock a la vez | El `updateOne` condicional sobre `stock_actual - stock_reservado` deja pasar solo a uno; el otro ve la pantalla de stock insuficiente |
| Sube el precio de un producto | Se actualiza `productos.precio`. Los pedidos antiguos no cambian: `items.precio_unitario` es una foto histórica a propósito |
| Se renombra un insumo | `updateOne` en `insumos` y `updateMany` sobre `productos` (`receta.insumo_id` = ese id) para actualizar la copia del nombre |
| Cambia una marca de un insumo (por ejemplo, ahora contiene lactosa) | Hay que recalcular `apto_para` de los productos que lo usan. Es el costo de duplicar ese dato |
| El historial de un cliente crece mucho | No afecta: los pedidos son una colección aparte y el índice `{cliente._id, fecha}` sirve Q3 |
| Una receta pasa a tener decenas de insumos | Sigue siendo un arreglo acotado. Si creciera sin límite, se pasaría a una colección aparte |
| Se pide un reporte de ventas por producto | Q5: `$unwind` de `items`. Funciona porque los ítems están embebidos |
| Se agrega una consulta nueva ("pedidos del día") | Se agrega un índice sobre `fecha`; el diseño de documentos no cambia |

## Decisiones pendientes

1. **Alerta de stock crítico (RF13).** Se calcula con Q4 (`stock_actual <= stock_minimo`), no se guarda. No existe una tabla de alertas
   en el modelo. Si se quisiera historial de alertas, haría falta una colección nueva.
2. **Pagos rechazados.** El relacional admite `estado_pago` = `rechazado` o `pendiente`, pero el flujo solo crea el pedido
   cuando el pago se aprueba, así que en la práctica el subdocumento `pago` siempre dice `aprobado`.
3. **Etapa 3.** Se pide conectar BD relacional y no relacional a la vez, con los usuarios verificados con JWT en la
   BD relacional. Hay que decidir qué datos viven en cada una antes de migrar `usuarios`.

## Casos borde y decisiones adicionales

- **Tercera duplicación:** `pedidos.cliente.nombre` también es una copia (referencia extendida). Si el cliente cambia su nombre, los pedidos antiguos conservan el anterior (aceptable en un historial); para actualizarlos, `updateMany` sobre `pedidos` filtrando por `cliente._id`.
- **Producto con receta vacía:** `apto_para` debe ser `[]`, no "apto para todo". Se exige al menos un insumo en la receta antes de publicar el producto. Q1 ya excluye un producto sin receta (el `$unwind` lo descarta). Es un tema de alérgenos.
- **Stock entre validar y pagar:** resuelto con reservas que vencen (ver Q2). Decidido por el equipo el 19-10-2026.
- **Unicidad de nombres:** en el relacional `productos.nombre` e `insumos.nombre` no tienen `UNIQUE` (solo lo valida la app). En MongoDB: `db.insumos.createIndex({ nombre: 1 }, { unique: true })`, además del de `productos`.
- **Fechas de calendario:** `fecha_registro` como texto `"2026-08-10"` (en agosto Chile está en UTC-4; con `$date` un front en hora local mostraría el día 9). Las fechas con hora siguen en `$date` UTC.
- **Datos opcionales:** si el cliente no tiene teléfono o dirección, el campo se omite del subdocumento `cliente` (no se guarda `null`).
- **Precios:** enteros (CLP); validar entero en la API y en el esquema, aunque hoy la API acepta 2 decimales.
