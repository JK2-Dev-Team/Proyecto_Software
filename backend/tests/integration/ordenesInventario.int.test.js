// INTEGRACIÓN: el flujo central del negocio de punta a punta, sin simular nada propio.
// Petición HTTP real -> rutas -> servicios -> patrones Strategy/Observer -> PostgreSQL real.
// Después de cada acción se consulta la base de datos directamente para comprobar lo que quedó guardado.
const request = require('supertest');
const app = require('../../src/app');
const { db, prepararEsquema, limpiar, cerrar, crearUsuario, tokenDe, idProcedimiento } = require('../support/baseDatos');

let auth;
let corona;
let clienteId;

// Datos de la receta real de "Corona" que usa el laboratorio en la demostración:
// 2 de cerámica POR UNIDAD y 50 g de yeso FIJOS por orden.
async function sembrarInventario({ ceramica = 100, yeso = 450, minYeso = 400, minCeramica = 10 } = {}) {
  const ins = await db.query(
    `INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo) VALUES
       ('Cerámica', 'g', $1, $2), ('Yeso', 'g', $3, $4) RETURNING id, nombre`,
    [ceramica, minCeramica, yeso, minYeso]
  );
  const id = Object.fromEntries(ins.rows.map((r) => [r.nombre, r.id]));
  await db.query(
    `INSERT INTO procedimiento_insumos (tipo_procedimiento_id, insumo_id, cantidad, modo_consumo) VALUES
       ($1, $2, 2, 'por_unidad'), ($1, $3, 50, 'fijo')`,
    [corona, id['Cerámica'], id['Yeso']]
  );
  return id;
}

const stock = async (insumoId) =>
  Number((await db.query('SELECT stock_actual FROM insumos WHERE id = $1', [insumoId])).rows[0].stock_actual);
const alertasAbiertas = async () =>
  (await db.query('SELECT insumo_id FROM alertas_stock WHERE abierta')).rows.map((r) => r.insumo_id);

beforeAll(prepararEsquema);
afterAll(cerrar);

beforeEach(async () => {
  await limpiar();
  const admin = await crearUsuario();
  auth = { Authorization: `Bearer ${tokenDe(admin)}` };
  corona = await idProcedimiento('Corona');
  clienteId = (await db.query("INSERT INTO clientes (nombre, tipo) VALUES ('Dra. Prueba', 'odontologo') RETURNING id")).rows[0].id;
});

const crearOrden = (unidades = 3) =>
  request(app).post('/api/ordenes').set(auth).send({ cliente_id: clienteId, tipo_procedimiento_id: corona, unidades });
const avanzar = (id, estado) => request(app).patch(`/api/ordenes/${id}/estado`).set(auth).send({ estado });

describe('POST /api/ordenes', () => {
  test('201: crea la orden en estado "recibido" y deja el primer registro del historial', async () => {
    // Act
    const res = await crearOrden(3);

    // Assert: respuesta HTTP
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'recibido', unidades: 3, insumos_descontados: false });

    // Assert: persistencia real
    const historial = await db.query('SELECT estado_anterior, estado_nuevo FROM orden_historial_estados WHERE orden_id = $1', [res.body.id]);
    expect(historial.rows).toEqual([{ estado_anterior: null, estado_nuevo: 'recibido' }]);
  });

  test('400: sin cliente o procedimiento, o con unidades menores a 1 (valor límite 0)', async () => {
    expect((await request(app).post('/api/ordenes').set(auth).send({ tipo_procedimiento_id: corona })).status).toBe(400);
    expect((await crearOrden(0)).status).toBe(400);
    expect((await db.query('SELECT COUNT(*)::int AS n FROM ordenes_trabajo')).rows[0].n).toBe(0);
  });

  test('400: un cliente que no existe es rechazado por la llave foránea real de la base', async () => {
    const res = await request(app).post('/api/ordenes').set(auth).send({ cliente_id: 9999, tipo_procedimiento_id: corona });
    expect(res.status).toBe(400);
    expect((await db.query('SELECT COUNT(*)::int AS n FROM ordenes_trabajo')).rows[0].n).toBe(0);
  });

  test('401: sin sesión no se crea nada', async () => {
    const res = await request(app).post('/api/ordenes').send({ cliente_id: clienteId, tipo_procedimiento_id: corona });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/ordenes/:id/estado — descuento automático de insumos', () => {
  test('al entrar a "en_modelado" descuenta 2 por unidad de cerámica y 50 fijos de yeso, y registra los movimientos', async () => {
    // Arrange
    const id = await sembrarInventario({ ceramica: 100, yeso: 1000, minYeso: 20 });
    const orden = (await crearOrden(3)).body;

    // Act
    const res = await avanzar(orden.id, 'en_modelado');

    // Assert
    expect(res.status).toBe(200);
    expect(await stock(id['Cerámica'])).toBe(94); // 100 - 2 x 3 unidades
    expect(await stock(id['Yeso'])).toBe(950); // 1000 - 50 (fijo, no depende de las unidades)

    const movs = await db.query(
      'SELECT insumo_id, tipo, cantidad::float AS cantidad FROM movimientos_inventario WHERE orden_id = $1 ORDER BY insumo_id',
      [orden.id]
    );
    expect(movs.rows).toEqual([
      { insumo_id: id['Cerámica'], tipo: 'salida', cantidad: 6 },
      { insumo_id: id['Yeso'], tipo: 'salida', cantidad: 50 },
    ]);
    const o = await db.query('SELECT estado, insumos_descontados FROM ordenes_trabajo WHERE id = $1', [orden.id]);
    expect(o.rows[0]).toEqual({ estado: 'en_modelado', insumos_descontados: true });
  });

  test('Observer: si el stock queda EN el mínimo (valor límite) se abre la alerta de stock bajo', async () => {
    // 450 - 50 = 400, igual al mínimo de 400 -> debe alertar (la regla es "stock <= mínimo")
    const id = await sembrarInventario({ yeso: 450, minYeso: 400 });
    const orden = (await crearOrden(1)).body;

    await avanzar(orden.id, 'en_modelado');

    expect(await alertasAbiertas()).toEqual([id['Yeso']]);
  });

  test('Observer: si el stock queda un poco POR ENCIMA del mínimo no hay alerta', async () => {
    await sembrarInventario({ yeso: 451, minYeso: 400 }); // queda en 401
    const orden = (await crearOrden(1)).body;

    await avanzar(orden.id, 'en_modelado');

    expect(await alertasAbiertas()).toEqual([]);
  });

  test('una entrada que recupera el stock cierra la alerta', async () => {
    const id = await sembrarInventario({ yeso: 450, minYeso: 400 });
    await avanzar((await crearOrden(1)).body.id, 'en_modelado'); // abre alerta

    const res = await request(app).post(`/api/inventario/${id['Yeso']}/movimientos`).set(auth).send({ tipo: 'entrada', cantidad: 50 });

    expect(res.status).toBe(201);
    expect(await alertasAbiertas()).toEqual([]);
    const cerrada = await db.query('SELECT cerrada_en FROM alertas_stock WHERE insumo_id = $1', [id['Yeso']]);
    expect(cerrada.rows[0].cerrada_en).not.toBeNull();
  });

  test('stock exactamente suficiente (valor límite): se permite y el insumo queda en 0', async () => {
    const id = await sembrarInventario({ ceramica: 6, yeso: 50, minYeso: 0, minCeramica: 0 });
    const orden = (await crearOrden(3)).body;

    expect((await avanzar(orden.id, 'en_modelado')).status).toBe(200);
    expect(await stock(id['Cerámica'])).toBe(0);
    expect(await stock(id['Yeso'])).toBe(0);
  });

  test('409 stock insuficiente: la transacción se revierte completa (ni stock, ni movimientos, ni estado)', async () => {
    // Hay cerámica suficiente pero le falta 1 g de yeso: el primer descuento también debe deshacerse.
    const id = await sembrarInventario({ ceramica: 100, yeso: 49, minYeso: 0 });
    const orden = (await crearOrden(3)).body;

    const res = await avanzar(orden.id, 'en_modelado');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Stock insuficiente de "Yeso"/);
    expect(await stock(id['Cerámica'])).toBe(100);
    expect(await stock(id['Yeso'])).toBe(49);
    expect((await db.query('SELECT COUNT(*)::int AS n FROM movimientos_inventario')).rows[0].n).toBe(0);
    expect((await db.query('SELECT estado FROM ordenes_trabajo WHERE id = $1', [orden.id])).rows[0].estado).toBe('recibido');
  });

  test('el descuento ocurre una sola vez aunque la orden vuelva a cocción por retrabajo', async () => {
    const id = await sembrarInventario({ ceramica: 100, yeso: 1000, minYeso: 0 });
    const orden = (await crearOrden(3)).body;
    for (const e of ['en_modelado', 'en_coccion_acabado', 'control_calidad', 'en_coccion_acabado', 'control_calidad', 'terminado', 'entregado']) {
      expect((await avanzar(orden.id, e)).status).toBe(200);
    }

    expect(await stock(id['Cerámica'])).toBe(94);
    expect(await stock(id['Yeso'])).toBe(950);

    const detalle = await request(app).get(`/api/ordenes/${orden.id}`).set(auth);
    expect(detalle.status).toBe(200);
    expect(detalle.body.historial.map((h) => h.estado_nuevo)).toEqual([
      'recibido', 'en_modelado', 'en_coccion_acabado', 'control_calidad', 'en_coccion_acabado', 'control_calidad', 'terminado', 'entregado',
    ]);
  });

  test('409: no se puede saltar etapas (de "recibido" a "terminado") y no se toca el inventario', async () => {
    const id = await sembrarInventario();
    const orden = (await crearOrden(3)).body;

    const res = await avanzar(orden.id, 'terminado');

    expect(res.status).toBe(409);
    expect(await stock(id['Cerámica'])).toBe(100);
  });

  test('400 estado inexistente y 404 orden inexistente', async () => {
    const orden = (await crearOrden(1)).body;
    expect((await avanzar(orden.id, 'volando')).status).toBe(400);
    expect((await avanzar(9999, 'en_modelado')).status).toBe(404);
    expect((await request(app).get('/api/ordenes/9999').set(auth)).status).toBe(404);
  });
});

describe('/api/inventario', () => {
  test('201 crear insumo (solo admin) y 409 si el nombre ya existe (restricción UNIQUE real)', async () => {
    const insumo = { nombre: 'Resina', unidad: 'ml', stock_actual: 30, stock_minimo: 40 };

    const res = await request(app).post('/api/inventario').set(auth).send(insumo);
    expect(res.status).toBe(201);
    // Nace por debajo del mínimo: el Observer abre la alerta desde el alta
    expect(await alertasAbiertas()).toEqual([res.body.id]);

    expect((await request(app).post('/api/inventario').set(auth).send(insumo)).status).toBe(409);
  });

  test('403: una recepcionista no puede crear insumos', async () => {
    const recep = await crearUsuario({ email: 'recep@prueba.co', rol: 'recepcionista' });
    const res = await request(app)
      .post('/api/inventario')
      .set({ Authorization: `Bearer ${tokenDe(recep)}` })
      .send({ nombre: 'Cera', unidad: 'g' });
    expect(res.status).toBe(403);
  });

  test('salida manual: 409 si deja el stock negativo, 400 con cantidad 0 y 404 si el insumo no existe', async () => {
    const id = await sembrarInventario({ ceramica: 5 });
    const mov = (insumo, cuerpo) => request(app).post(`/api/inventario/${insumo}/movimientos`).set(auth).send(cuerpo);

    expect((await mov(id['Cerámica'], { tipo: 'salida', cantidad: 6 })).status).toBe(409);
    expect((await mov(id['Cerámica'], { tipo: 'salida', cantidad: 0 })).status).toBe(400);
    expect((await mov(9999, { tipo: 'entrada', cantidad: 1 })).status).toBe(404);
    expect(await stock(id['Cerámica'])).toBe(5);
  });

  test('GET lista insumos, filtra los de stock bajo y lista las alertas abiertas', async () => {
    await sembrarInventario({ yeso: 300, minYeso: 400 }); // el yeso arranca bajo el mínimo

    const todos = await request(app).get('/api/inventario').set(auth);
    expect(todos.status).toBe(200);
    expect(todos.body.map((i) => i.nombre).sort()).toEqual(['Cerámica', 'Yeso']);

    const bajos = await request(app).get('/api/inventario?bajoStock=true').set(auth);
    expect(bajos.body.map((i) => i.nombre)).toEqual(['Yeso']);

    const alertas = await request(app).get('/api/inventario/alertas').set(auth);
    expect(alertas.status).toBe(200);
    expect(Array.isArray(alertas.body)).toBe(true);
  });

  test('GET /api/procedimientos devuelve los procedimientos sembrados por schema.sql', async () => {
    const res = await request(app).get('/api/procedimientos').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.nombre)).toEqual(expect.arrayContaining(['Corona', 'Puente']));
  });
});
