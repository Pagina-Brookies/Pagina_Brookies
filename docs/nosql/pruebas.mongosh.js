// Pruebas de las consultas del traspaso (Q1-Q5 + índices + transacción).
// Uso:  mongosh "<cadena de conexión de Atlas>" --file docs/nosql/pruebas.mongosh.js
// Crea la base de prueba "brookies_pruebas", corre todo y la borra al final.
// Los datos son los del seed relacional (migrations/002_seed.sql), pedidos 1 a 4.

const dbp = db.getSiblingDB("brookies_pruebas");
dbp.dropDatabase();
let fallas = 0;
function check(nombre, cond, info) {
  if (!cond) fallas++;
  print((cond ? "OK    " : "FALLA ") + nombre + (info !== undefined ? "  " + JSON.stringify(info) : ""));
}

dbp.insumos.insertMany([{"_id": 1, "nombre": "Café molido", "unidad_medida": "g", "stock_actual": 4500, "stock_minimo": 1000, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "stock_actual": 9000, "stock_minimo": 3000, "contiene_gluten": false, "contiene_lactosa": true, "es_origen_animal": true}, {"_id": 3, "nombre": "Leche de avena", "unidad_medida": "ml", "stock_actual": 5000, "stock_minimo": 1500, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "stock_actual": 7000, "stock_minimo": 1500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "stock_actual": 9000, "stock_minimo": 2000, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "stock_actual": 2400, "stock_minimo": 800, "contiene_gluten": false, "contiene_lactosa": true, "es_origen_animal": true}, {"_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "stock_actual": 20, "stock_minimo": 24, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": true}, {"_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "stock_actual": 2200, "stock_minimo": 500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 9, "nombre": "Matcha en polvo", "unidad_medida": "g", "stock_actual": 90, "stock_minimo": 100, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 10, "nombre": "Harina de almendras", "unidad_medida": "g", "stock_actual": 1500, "stock_minimo": 400, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 11, "nombre": "Aceite vegetal", "unidad_medida": "ml", "stock_actual": 1800, "stock_minimo": 500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 12, "nombre": "Avena en hojuelas", "unidad_medida": "g", "stock_actual": 2500, "stock_minimo": 500, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}]);
dbp.insumos.updateMany({}, { $set: { stock_reservado: 0 } });
dbp.productos.insertMany([{"_id": 1, "nombre": "Espresso", "descripcion": "Shot de espresso", "precio": 1800, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}]}, {"_id": 2, "nombre": "Americano", "descripcion": "Espresso alargado con agua caliente", "precio": 2200, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}]}, {"_id": 3, "nombre": "Latte", "descripcion": "Espresso con leche entera texturizada", "precio": 2900, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_gluten"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "cantidad_requerida": 200}]}, {"_id": 4, "nombre": "Cappuccino", "descripcion": "Espresso con leche y espuma", "precio": 2900, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_gluten"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "cantidad_requerida": 120}]}, {"_id": 5, "nombre": "Latte de avena", "descripcion": "Espresso con leche de avena", "precio": 3200, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 3, "nombre": "Leche de avena", "unidad_medida": "ml", "cantidad_requerida": 200}]}, {"_id": 6, "nombre": "Cold brew", "descripcion": "Café de extracción en frío con hielo", "precio": 3300, "categoria": "Café", "tipo_preparacion": "frio", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 25}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 5}]}, {"_id": 7, "nombre": "Matcha", "descripcion": "Matcha ceremonial batido con agua caliente", "precio": 2200, "categoria": "Té", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa", "vegano"], "receta": [{"insumo_id": 9, "nombre": "Matcha en polvo", "unidad_medida": "g", "cantidad_requerida": 3}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 5}]}, {"_id": 8, "nombre": "Galleta de chocolate", "descripcion": "Galleta con chips de chocolate", "precio": 1900, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "cantidad_requerida": 40}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 35}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 0.5}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 30}]}, {"_id": 9, "nombre": "Galleta vegana de avena", "descripcion": "Galleta de avena sin huevo ni lácteos", "precio": 2100, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 50}, {"insumo_id": 11, "nombre": "Aceite vegetal", "unidad_medida": "ml", "cantidad_requerida": 30}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 35}, {"insumo_id": 12, "nombre": "Avena en hojuelas", "unidad_medida": "g", "cantidad_requerida": 40}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 20}]}, {"_id": 10, "nombre": "Galleta sin gluten de almendras", "descripcion": "Galleta de harina de almendras", "precio": 2300, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa"], "receta": [{"insumo_id": 10, "nombre": "Harina de almendras", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 30}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 0.5}]}, {"_id": 11, "nombre": "Brookie clásico", "descripcion": "Mezcla de brownie y galleta", "precio": 2600, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 70}, {"insumo_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 50}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 1}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 50}]}, {"_id": 12, "nombre": "Brookie de temporada", "descripcion": "Retirado del menú por ahora", "precio": 2800, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": false, "apto_para": [], "receta": []}]);
dbp.pedidos.insertMany(EJSON.deserialize([{"_id": 1, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 3, "nombre": "Latte", "cantidad": 2, "precio_unitario": 2900}, {"producto_id": 8, "nombre": "Galleta de chocolate", "cantidad": 1, "precio_unitario": 1900}], "total": 7700, "fecha": {"$date": "2026-09-11T15:00:00Z"}}, {"_id": 2, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 6, "nombre": "Cold brew", "cantidad": 1, "precio_unitario": 3300}, {"producto_id": 11, "nombre": "Brookie clásico", "cantidad": 2, "precio_unitario": 2600}], "total": 8500, "fecha": {"$date": "2026-09-12T15:00:00Z"}}, {"_id": 3, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 4, "nombre": "Cappuccino", "cantidad": 2, "precio_unitario": 2900}, {"producto_id": 9, "nombre": "Galleta vegana de avena", "cantidad": 1, "precio_unitario": 2100}], "total": 7900, "fecha": {"$date": "2026-09-13T15:00:00Z"}}, {"_id": 4, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 1, "nombre": "Espresso", "cantidad": 1, "precio_unitario": 1800}, {"producto_id": 7, "nombre": "Matcha", "cantidad": 1, "precio_unitario": 2200}, {"producto_id": 3, "nombre": "Latte", "cantidad": 1, "precio_unitario": 2900}], "total": 6900, "fecha": {"$date": "2026-09-14T15:00:00Z"}}]));

// ---- índices
dbp.productos.createIndex({ nombre: 1 }, { unique: true });
dbp.insumos.createIndex({ nombre: 1 }, { unique: true });
dbp.productos.createIndex({ categoria: 1, disponible: 1, precio: 1 });
dbp.productos.createIndex({ apto_para: 1 });
dbp.productos.createIndex({ "receta.insumo_id": 1 });
dbp.pedidos.createIndex({ "cliente._id": 1, fecha: -1 });
try { dbp.insumos.insertOne({ _id: 99, nombre: "Huevos" }); check("índice único insumos.nombre", false); }
catch (e) { check("índice único insumos.nombre rechaza duplicado", e.code === 11000); }

// ---- Q1 menú con filtros
let r = dbp.productos.find(
  { categoria: "Café", disponible: true, tipo_preparacion: "caliente", apto_para: "vegano" },
  { nombre: 1, precio: 1 }).sort({ precio: 1 }).toArray();
check("Q1 find (Café, caliente, vegano)", JSON.stringify(r.map(x => x.nombre)) === JSON.stringify(["Espresso", "Americano", "Latte de avena"]), r.map(x => x.nombre));

// ---- Q1 disponibilidad efectiva
const q1 = [
  { $match: { disponible: true } },
  { $unwind: "$receta" },                       // un producto sin receta desaparece aquí
  { $lookup: { from: "insumos", localField: "receta.insumo_id", foreignField: "_id", as: "insumo" } },
  { $unwind: "$insumo" },
  { $group: { _id: "$_id", nombre: { $first: "$nombre" }, precio: { $first: "$precio" },
              categoria: { $first: "$categoria" }, apto_para: { $first: "$apto_para" },
              insumos_sin_stock: { $sum: { $cond: [{ $lt: ["$insumo.stock_actual", "$receta.cantidad_requerida"] }, 1, 0] } } } },
  { $match: { insumos_sin_stock: 0 } },
  { $sort: { precio: 1, nombre: 1 } }
];
check("Q1 disponibilidad efectiva: 11 productos", dbp.productos.aggregate(q1).toArray().length === 11);
dbp.productos.updateOne({ _id: 12 }, { $set: { disponible: true } });
check("Q1 producto sin receta no aparece", !dbp.productos.aggregate(q1).toArray().some(x => x._id === 12));
dbp.productos.updateOne({ _id: 12 }, { $set: { disponible: false } });
dbp.insumos.updateOne({ _id: 7 }, { $set: { stock_actual: 0 } });
let ids = dbp.productos.aggregate(q1).toArray().map(x => x._id);
check("Q1 sin huevos salen las galletas 8, 10 y 11", ![8, 10, 11].some(i => ids.includes(i)) && ids.includes(9));
dbp.insumos.updateOne({ _id: 7 }, { $set: { stock_actual: 20 } });

// ---- Q2 vender con transacción (Atlas es replica set)
function vender(productoId, cantidad) {
  const session = db.getMongo().startSession();
  try {
    session.withTransaction(() => {
      const s = session.getDatabase("brookies_pruebas");
      for (const rr of s.productos.findOne({ _id: productoId }).receta) {
        const res = s.insumos.updateOne(
          { _id: rr.insumo_id, stock_actual: { $gte: rr.cantidad_requerida * cantidad } },
          { $inc: { stock_actual: -rr.cantidad_requerida * cantidad } });
        if (res.modifiedCount === 0) throw new Error("Stock insuficiente: " + rr.nombre);
      }
    });
    return true;
  } catch (e) { return false; } finally { session.endSession(); }
}
check("Q2 vende 2 Latte", vender(3, 2) && dbp.insumos.findOne({ _id: 1 }).stock_actual === 4468 && dbp.insumos.findOne({ _id: 2 }).stock_actual === 8600);
check("Q2 rechaza 50 galletas de chocolate y revierte la harina", !vender(8, 50) && dbp.insumos.findOne({ _id: 5 }).stock_actual === 9000);

// ---- Q2 con reserva (como los asientos de un cine): reservar -> pagar -> descontar
function liberarVencidas(s, ahora) {
  for (const r of s.reservas.find({ estado: "activa", expira_en: { $lte: ahora } }).toArray()) {
    for (const n of r.insumos) s.insumos.updateOne({ _id: n.insumo_id }, { $inc: { stock_reservado: -n.cantidad } });
    s.reservas.updateOne({ _id: r._id }, { $set: { estado: "liberada" } });
  }
}
function reservar(idReserva, productoId, cantidad, ahora) {
  const session = db.getMongo().startSession();
  try {
    session.withTransaction(() => {
      const s = session.getDatabase("brookies_pruebas");
      liberarVencidas(s, ahora);
      const necesita = s.productos.findOne({ _id: productoId }).receta
        .map(r => ({ insumo_id: r.insumo_id, cantidad: r.cantidad_requerida * cantidad }));
      for (const n of necesita) {
        const res = s.insumos.updateOne(
          { _id: n.insumo_id, $expr: { $gte: [{ $subtract: ["$stock_actual", "$stock_reservado"] }, n.cantidad] } },
          { $inc: { stock_reservado: n.cantidad } });
        if (res.modifiedCount === 0) throw new Error("Stock insuficiente");
      }
      s.reservas.insertOne({ _id: idReserva, insumos: necesita, estado: "activa", expira_en: new Date(ahora.getTime() + 10 * 60 * 1000) });
    });
    return true;
  } catch (e) { return false; } finally { session.endSession(); }
}
function pagar(idReserva, ahora) {
  const session = db.getMongo().startSession();
  try {
    session.withTransaction(() => {
      const s = session.getDatabase("brookies_pruebas");
      const r = s.reservas.findOneAndUpdate({ _id: idReserva, estado: "activa", expira_en: { $gt: ahora } }, { $set: { estado: "pagada" } });
      if (!r) throw new Error("Reserva vencida");
      for (const n of r.insumos)
        s.insumos.updateOne({ _id: n.insumo_id }, { $inc: { stock_actual: -n.cantidad, stock_reservado: -n.cantidad } });
    });
    return true;
  } catch (e) { return false; } finally { session.endSession(); }
}
const huevos = () => dbp.insumos.findOne({ _id: 7 });
const t0 = new Date("2026-10-20T12:00:00Z"), min = (m) => new Date(t0.getTime() + m * 60000);
// Brookie clásico (11) usa 1 huevo; hay 20
check("Reserva 15 brookies: aparta 15 huevos sin descontarlos", reservar(1, 11, 15, t0) && huevos().stock_actual === 20 && huevos().stock_reservado === 15);
check("Otra reserva de 10 se rechaza (solo quedan 5 libres)", !reservar(2, 11, 10, t0) && huevos().stock_reservado === 15);
check("Pago aprobado: descuenta lo reservado", pagar(1, min(5)) && huevos().stock_actual === 5 && huevos().stock_reservado === 0);
check("Reserva de 5 y el cliente abandona", reservar(3, 11, 5, min(6)) && huevos().stock_reservado === 5);
check("Al vencer, la siguiente reserva la libera", reservar(4, 11, 5, min(20)) && huevos().stock_reservado === 5);
check("Pago que llega con la reserva vencida se rechaza", !pagar(3, min(21)) && huevos().stock_actual === 5);
dbp.insumos.updateOne({ _id: 7 }, { $set: { stock_actual: 20, stock_reservado: 0 } });

// ---- Q3 historial
r = dbp.pedidos.find({ "cliente._id": 2 }).sort({ fecha: -1 }).toArray();
check("Q3 historial ordenado", JSON.stringify(r.map(x => x._id)) === "[4,3,2,1]");

// ---- Q4 críticos
r = dbp.insumos.aggregate([
  { $match: { $expr: { $lte: ["$stock_actual", "$stock_minimo"] } } },
  { $lookup: { from: "productos", localField: "_id", foreignField: "receta.insumo_id", as: "productos" } },
  { $project: { nombre: 1, stock_actual: 1, stock_minimo: 1, "productos.nombre": 1 } },
  { $sort: { nombre: 1 } }]).toArray();
check("Q4 críticos: Huevos (3 productos) y Matcha en polvo (1)", r.length === 2 && r[0].nombre === "Huevos" && r[0].productos.length === 3 && r[1].productos.length === 1);

// ---- Q5 más vendidos
r = dbp.pedidos.aggregate([
  { $unwind: "$items" },
  { $group: { _id: "$items.producto_id", nombre: { $first: "$items.nombre" }, unidades_vendidas: { $sum: "$items.cantidad" } } },
  { $sort: { unidades_vendidas: -1, nombre: 1 } }]).toArray();
check("Q5 primero Latte con 3", r[0].nombre === "Latte" && r[0].unidades_vendidas === 3, r.slice(0, 3).map(x => [x.nombre, x.unidades_vendidas]));

print(fallas === 0 ? "\nTODO OK" : "\n" + fallas + " FALLAS");
dbp.dropDatabase();
