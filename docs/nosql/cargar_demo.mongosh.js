// Carga los datos de demostración en la base "brookies" de Atlas y los deja ahí
// (a diferencia de pruebas.mongosh.js, que usa una base temporal y la borra).
// Uso:  mongosh "<cadena de Atlas>" --username <usuario> --password <clave> --file docs/nosql/cargar_demo.mongosh.js
// Se puede correr varias veces: borra y vuelve a cargar solo la base "brookies".

const b = db.getSiblingDB("brookies");
b.dropDatabase();

b.usuarios.insertMany(EJSON.deserialize([
  {
    "_id": 2,
    "rol": "cliente",
    "nombre": "Ignacia Valdebenito",
    "correo": "ignacia.valdebenito@clientes.brookies.example",
    "contrasena_hash": "$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C",
    "fecha_registro": "2026-08-10",
    "ultimo_acceso": { "$date": "2026-09-18T15:05:00Z" },
    "activo": true,
    "cliente": {
      "telefono": "+56 9 1111 1111",
      "direccion": "Calle Ejemplo 123, Valparaíso"
    }
  },
  {
    "_id": 1,
    "rol": "administrador",
    "nombre": "Administrador Brookies",
    "correo": "admin@brookies.example",
    "contrasena_hash": "$2b$10$8.WvVNbcUmiB03Z5ueDQZ.FucsG7ag4AEwnmIjNONiGe6Y/4oZI8C",
    "fecha_registro": "2026-08-01",
    "ultimo_acceso": { "$date": "2026-09-19T12:00:00Z" },
    "activo": true,
    "administrador": {
      "cargo": "Dueño",
      "fecha_asignacion": { "$date": "2026-08-01T00:00:00Z" }
    }
  }
]));
b.insumos.insertMany([{"_id": 1, "nombre": "Café molido", "unidad_medida": "g", "stock_actual": 4500, "stock_minimo": 1000, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "stock_actual": 9000, "stock_minimo": 3000, "contiene_gluten": false, "contiene_lactosa": true, "es_origen_animal": true}, {"_id": 3, "nombre": "Leche de avena", "unidad_medida": "ml", "stock_actual": 5000, "stock_minimo": 1500, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "stock_actual": 7000, "stock_minimo": 1500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "stock_actual": 9000, "stock_minimo": 2000, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "stock_actual": 2400, "stock_minimo": 800, "contiene_gluten": false, "contiene_lactosa": true, "es_origen_animal": true}, {"_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "stock_actual": 20, "stock_minimo": 24, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": true}, {"_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "stock_actual": 2200, "stock_minimo": 500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 9, "nombre": "Matcha en polvo", "unidad_medida": "g", "stock_actual": 90, "stock_minimo": 100, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 10, "nombre": "Harina de almendras", "unidad_medida": "g", "stock_actual": 1500, "stock_minimo": 400, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 11, "nombre": "Aceite vegetal", "unidad_medida": "ml", "stock_actual": 1800, "stock_minimo": 500, "contiene_gluten": false, "contiene_lactosa": false, "es_origen_animal": false}, {"_id": 12, "nombre": "Avena en hojuelas", "unidad_medida": "g", "stock_actual": 2500, "stock_minimo": 500, "contiene_gluten": true, "contiene_lactosa": false, "es_origen_animal": false}]);
b.insumos.updateMany({}, { $set: { stock_reservado: 0 } });
b.productos.insertMany([{"_id": 1, "nombre": "Espresso", "descripcion": "Shot de espresso", "precio": 1800, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}]}, {"_id": 2, "nombre": "Americano", "descripcion": "Espresso alargado con agua caliente", "precio": 2200, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}]}, {"_id": 3, "nombre": "Latte", "descripcion": "Espresso con leche entera texturizada", "precio": 2900, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "cantidad_requerida": 200}]}, {"_id": 4, "nombre": "Cappuccino", "descripcion": "Espresso con leche y espuma", "precio": 2900, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 2, "nombre": "Leche entera", "unidad_medida": "ml", "cantidad_requerida": 120}]}, {"_id": 5, "nombre": "Latte de avena", "descripcion": "Espresso con leche de avena", "precio": 3200, "categoria": "Café", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 16}, {"insumo_id": 3, "nombre": "Leche de avena", "unidad_medida": "ml", "cantidad_requerida": 200}]}, {"_id": 6, "nombre": "Cold brew", "descripcion": "Café de extracción en frío con hielo", "precio": 3300, "categoria": "Café", "tipo_preparacion": "frio", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 1, "nombre": "Café molido", "unidad_medida": "g", "cantidad_requerida": 25}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 5}]}, {"_id": 7, "nombre": "Matcha", "descripcion": "Matcha ceremonial batido con agua caliente", "precio": 2200, "categoria": "Té", "tipo_preparacion": "caliente", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 9, "nombre": "Matcha en polvo", "unidad_medida": "g", "cantidad_requerida": 3}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 5}]}, {"_id": 8, "nombre": "Galleta de chocolate", "descripcion": "Galleta con chips de chocolate", "precio": 1900, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "cantidad_requerida": 40}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 35}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 0.5}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 30}]}, {"_id": 9, "nombre": "Galleta vegana de avena", "descripcion": "Galleta de avena sin huevo ni lácteos", "precio": 2100, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": ["sin_lactosa", "vegano"], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 50}, {"insumo_id": 11, "nombre": "Aceite vegetal", "unidad_medida": "ml", "cantidad_requerida": 30}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 35}, {"insumo_id": 12, "nombre": "Avena en hojuelas", "unidad_medida": "g", "cantidad_requerida": 40}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 20}]}, {"_id": 10, "nombre": "Galleta sin gluten de almendras", "descripcion": "Galleta de harina de almendras", "precio": 2300, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": ["sin_gluten", "sin_lactosa"], "receta": [{"insumo_id": 10, "nombre": "Harina de almendras", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 30}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 0.5}]}, {"_id": 11, "nombre": "Brookie clásico", "descripcion": "Mezcla de brownie y galleta", "precio": 2600, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": true, "apto_para": [], "receta": [{"insumo_id": 5, "nombre": "Harina de trigo", "unidad_medida": "g", "cantidad_requerida": 70}, {"insumo_id": 6, "nombre": "Mantequilla", "unidad_medida": "g", "cantidad_requerida": 60}, {"insumo_id": 4, "nombre": "Azúcar", "unidad_medida": "g", "cantidad_requerida": 50}, {"insumo_id": 7, "nombre": "Huevos", "unidad_medida": "unidad", "cantidad_requerida": 1}, {"insumo_id": 8, "nombre": "Chips de chocolate", "unidad_medida": "g", "cantidad_requerida": 50}]}, {"_id": 12, "nombre": "Brookie de temporada", "descripcion": "Retirado del menú por ahora", "precio": 2800, "categoria": "Galleta", "tipo_preparacion": "no_aplica", "disponible": false, "apto_para": [], "receta": []}]);
b.pedidos.insertMany(EJSON.deserialize([{"_id": 1, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 3, "nombre": "Latte", "cantidad": 2, "precio_unitario": 2900}, {"producto_id": 8, "nombre": "Galleta de chocolate", "cantidad": 1, "precio_unitario": 1900}], "total": 7700, "fecha": {"$date": "2026-09-11T15:00:00Z"}, "estado": "listo", "pago": {"monto": 7700, "metodo_pago": "tarjeta", "token_transaccion": "tok_demo_0001", "estado_pago": "aprobado", "fecha_pago": {"$date": "2026-09-11T15:00:00Z"}}}, {"_id": 2, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 6, "nombre": "Cold brew", "cantidad": 1, "precio_unitario": 3300}, {"producto_id": 11, "nombre": "Brookie clásico", "cantidad": 2, "precio_unitario": 2600}], "total": 8500, "fecha": {"$date": "2026-09-12T15:00:00Z"}, "estado": "listo", "pago": {"monto": 8500, "metodo_pago": "tarjeta", "token_transaccion": "tok_demo_0002", "estado_pago": "aprobado", "fecha_pago": {"$date": "2026-09-12T15:00:00Z"}}}, {"_id": 3, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 4, "nombre": "Cappuccino", "cantidad": 2, "precio_unitario": 2900}, {"producto_id": 9, "nombre": "Galleta vegana de avena", "cantidad": 1, "precio_unitario": 2100}], "total": 7900, "fecha": {"$date": "2026-09-13T15:00:00Z"}, "estado": "listo", "pago": {"monto": 7900, "metodo_pago": "tarjeta", "token_transaccion": "tok_demo_0003", "estado_pago": "aprobado", "fecha_pago": {"$date": "2026-09-13T15:00:00Z"}}}, {"_id": 4, "cliente": {"_id": 2, "nombre": "Ignacia Valdebenito"}, "items": [{"producto_id": 1, "nombre": "Espresso", "cantidad": 1, "precio_unitario": 1800}, {"producto_id": 7, "nombre": "Matcha", "cantidad": 1, "precio_unitario": 2200}, {"producto_id": 3, "nombre": "Latte", "cantidad": 1, "precio_unitario": 2900}], "total": 6900, "fecha": {"$date": "2026-09-14T15:00:00Z"}, "estado": "recibido", "pago": {"monto": 6900, "metodo_pago": "tarjeta", "token_transaccion": "tok_demo_0004", "estado_pago": "aprobado", "fecha_pago": {"$date": "2026-09-14T15:00:00Z"}}}]));
b.reservas.insertMany(EJSON.deserialize([
  {
    "_id": 7,
    "cliente": {
      "_id": 2,
      "nombre": "Ignacia Valdebenito"
    },
    "items": [
      {
        "producto_id": 3,
        "nombre": "Latte",
        "cantidad": 2,
        "precio_unitario": 2900
      }
    ],
    "insumos": [
      {
        "insumo_id": 1,
        "cantidad": 32
      },
      {
        "insumo_id": 2,
        "cantidad": 400
      }
    ],
    "estado": "activa",
    "creada_en": {
      "$date": "2026-09-19T15:40:00Z"
    },
    "expira_en": {
      "$date": "2026-09-19T15:50:00Z"
    }
  }
]));
// la reserva de ejemplo aparta café y leche: se refleja en stock_reservado
b.insumos.updateOne({ _id: 1 }, { $set: { stock_reservado: 32 } });
b.insumos.updateOne({ _id: 2 }, { $set: { stock_reservado: 400 } });

b.usuarios.createIndex({ correo: 1 }, { unique: true });
b.productos.createIndex({ nombre: 1 }, { unique: true });
b.insumos.createIndex({ nombre: 1 }, { unique: true });
b.productos.createIndex({ categoria: 1, disponible: 1, precio: 1 });
b.productos.createIndex({ apto_para: 1 });
b.productos.createIndex({ "receta.insumo_id": 1 });
b.pedidos.createIndex({ "cliente._id": 1, fecha: -1 });
b.reservas.createIndex({ estado: 1, expira_en: 1 });

for (const c of ["usuarios", "productos", "insumos", "pedidos", "reservas"])
  print(c.padEnd(10) + b[c].countDocuments() + " documentos");
print("Listo: abre Atlas > Data Explorer > brookies");
