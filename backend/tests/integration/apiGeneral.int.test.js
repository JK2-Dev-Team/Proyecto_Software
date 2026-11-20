// INTEGRACIÓN: autenticación, clientes, citas, usuarios y reportes contra PostgreSQL real.
// Verifica códigos HTTP y que los datos queden (o no queden) guardados en la base.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { db, prepararEsquema, limpiar, cerrar, crearUsuario, tokenDe } = require('../support/baseDatos');

let admin;
let auth;

beforeAll(prepararEsquema);
afterAll(cerrar);

beforeEach(async () => {
  await limpiar();
  admin = await crearUsuario({ email: 'admin@prueba.co', password: 'Clave12345' });
  auth = { Authorization: `Bearer ${tokenDe(admin)}` };
});

const contar = async (tabla) => (await db.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`)).rows[0].n;

describe('POST /api/auth/login (bcrypt + JWT reales)', () => {
  test('200: credenciales correctas devuelven un token que abre las rutas protegidas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@prueba.co ', password: 'Clave12345' });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ email: 'admin@prueba.co', rol: 'admin' });
    const yo = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${res.body.token}` });
    expect(yo.status).toBe(200);
  });

  test('401: contraseña incorrecta, correo inexistente o usuario desactivado (mismo mensaje genérico)', async () => {
    await crearUsuario({ email: 'inactivo@prueba.co', activo: false });
    const intentos = [
      { email: 'admin@prueba.co', password: 'otraClave1' },
      { email: 'nadie@prueba.co', password: 'Clave12345' },
      { email: 'inactivo@prueba.co', password: 'Clave12345' },
    ];
    for (const cuerpo of intentos) {
      const res = await request(app).post('/api/auth/login').send(cuerpo);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Credenciales inválidas');
    }
  });

  test('400: faltan datos', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'admin@prueba.co' })).status).toBe(400);
  });
});

describe('/api/clientes', () => {
  test('201 crea, guarda en la base con el nombre recortado, y luego se obtiene y actualiza', async () => {
    const res = await request(app).post('/api/clientes').set(auth).send({ nombre: '  Dr. Álvarez  ', tipo: 'odontologo' });

    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Dr. Álvarez');
    expect(await contar('clientes')).toBe(1);

    const upd = await request(app).put(`/api/clientes/${res.body.id}`).set(auth).send({ nombre: 'Dr. Álvarez Ruiz', tipo: 'odontologo', telefono: '3001234567' });
    expect(upd.status).toBe(200);
    const guardado = await db.query('SELECT nombre, telefono FROM clientes WHERE id = $1', [res.body.id]);
    expect(guardado.rows[0]).toEqual({ nombre: 'Dr. Álvarez Ruiz', telefono: '3001234567' });
  });

  test('400 datos inválidos (no guarda nada), 404 cliente inexistente y 401 sin sesión', async () => {
    expect((await request(app).post('/api/clientes').set(auth).send({ nombre: 'X', tipo: 'proveedor' })).status).toBe(400);
    expect((await request(app).post('/api/clientes').set(auth).send({ nombre: '   ', tipo: 'paciente' })).status).toBe(400);
    expect(await contar('clientes')).toBe(0);
    expect((await request(app).get('/api/clientes/9999').set(auth)).status).toBe(404);
    expect((await request(app).get('/api/clientes')).status).toBe(401);
  });
});

describe('/api/citas', () => {
  let clienteId;
  beforeEach(async () => {
    clienteId = (await db.query("INSERT INTO clientes (nombre, tipo) VALUES ('Ana Pérez', 'paciente') RETURNING id")).rows[0].id;
  });
  const nueva = (extra = {}) =>
    request(app).post('/api/citas').set(auth).send({ cliente_id: clienteId, fecha_hora: '2026-12-01T09:00:00-05:00', motivo: 'Toma de color', ...extra });

  test('201 crea la cita "pendiente" y 409 si se repite el mismo cliente a la misma hora', async () => {
    const res = await nueva();
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente');

    expect((await nueva()).status).toBe(409);
    expect(await contar('citas')).toBe(1);
  });

  test('una cita cancelada libera el horario', async () => {
    const cita = (await nueva()).body;
    expect((await request(app).patch(`/api/citas/${cita.id}/estado`).set(auth).send({ estado: 'cancelada' })).status).toBe(200);
    expect((await nueva()).status).toBe(201);
  });

  test('flujo de estados: pendiente → confirmada → completada; después no se puede editar ni cambiar', async () => {
    const cita = (await nueva()).body;
    const estado = (e) => request(app).patch(`/api/citas/${cita.id}/estado`).set(auth).send({ estado: e });

    expect((await estado('completada')).status).toBe(409); // no se puede saltar la confirmación
    expect((await estado('confirmada')).status).toBe(200);
    expect((await estado('completada')).status).toBe(200);
    expect((await estado('cancelada')).status).toBe(409);
    expect((await request(app).put(`/api/citas/${cita.id}`).set(auth).send({ motivo: 'Otro' })).status).toBe(409);

    const guardada = await db.query('SELECT estado FROM citas WHERE id = $1', [cita.id]);
    expect(guardada.rows[0].estado).toBe('completada');
  });

  test('400 fecha inválida o cliente faltante; 400 cliente inexistente (llave foránea real)', async () => {
    expect((await nueva({ fecha_hora: 'mañana' })).status).toBe(400);
    expect((await nueva({ cliente_id: undefined })).status).toBe(400);
    expect((await nueva({ cliente_id: 9999 })).status).toBe(400);
    expect(await contar('citas')).toBe(0);
  });
});

describe('/api/usuarios (solo administrador)', () => {
  test('201 crea un usuario con la contraseña cifrada en la base, y 409 con un correo repetido (UNIQUE real)', async () => {
    const cuerpo = { nombre: 'Laura', email: 'laura@prueba.co', password: 'ClaveSegura1', rol: 'recepcionista' };

    const res = await request(app).post('/api/usuarios').set(auth).send(cuerpo);
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password_hash');

    const fila = await db.query('SELECT password_hash FROM usuarios WHERE email = $1', ['laura@prueba.co']);
    expect(fila.rows[0].password_hash).not.toBe('ClaveSegura1');
    expect(await bcrypt.compare('ClaveSegura1', fila.rows[0].password_hash)).toBe(true);

    expect((await request(app).post('/api/usuarios').set(auth).send({ ...cuerpo, email: 'LAURA@prueba.co' })).status).toBe(409);
  });

  test('un usuario desactivado ya no puede iniciar sesión, y al reactivarlo sí', async () => {
    const laura = await crearUsuario({ nombre: 'Laura', email: 'laura@prueba.co', password: 'Clave12345', rol: 'recepcionista' });
    const login = () => request(app).post('/api/auth/login').send({ email: 'laura@prueba.co', password: 'Clave12345' });

    expect((await request(app).patch(`/api/usuarios/${laura.id}`).set(auth).send({ activo: false })).status).toBe(200);
    expect((await login()).status).toBe(401);
    expect((await request(app).patch(`/api/usuarios/${laura.id}`).set(auth).send({ activo: true })).status).toBe(200);
    expect((await login()).status).toBe(200);
  });

  test('409: el único administrador activo no puede ser desactivado por otro admin con token vigente', async () => {
    // Un segundo admin que ya fue desactivado pero cuyo token aún no vence intenta dejar el sistema sin admin.
    const otro = await crearUsuario({ email: 'otro@prueba.co', rol: 'admin', activo: false });
    const res = await request(app)
      .patch(`/api/usuarios/${admin.id}`)
      .set({ Authorization: `Bearer ${tokenDe(otro)}` })
      .send({ activo: false });

    expect(res.status).toBe(409);
    expect((await db.query('SELECT activo FROM usuarios WHERE id = $1', [admin.id])).rows[0].activo).toBe(true);
  });

  test('restablecer contraseña: la clave vieja deja de servir y la nueva funciona', async () => {
    const laura = await crearUsuario({ email: 'laura@prueba.co', password: 'Clave12345', rol: 'recepcionista' });
    const res = await request(app).put(`/api/usuarios/${laura.id}/password`).set(auth).send({ password: 'NuevaClave99' });
    expect(res.status).toBe(204);

    const login = (password) => request(app).post('/api/auth/login').send({ email: 'laura@prueba.co', password });
    expect((await login('Clave12345')).status).toBe(401);
    expect((await login('NuevaClave99')).status).toBe(200);
  });
});

describe('/api/reportes (consultas SQL reales con zona horaria de Bogotá)', () => {
  test('una orden creada a las 9:30 p. m. del 30 de octubre en Colombia cuenta para el 30, aunque en UTC ya sea 31', async () => {
    const c = (await db.query("INSERT INTO clientes (nombre, tipo) VALUES ('Dra. Ríos', 'odontologo') RETURNING id")).rows[0].id;
    const corona = (await db.query("SELECT id FROM tipos_procedimiento WHERE nombre = 'Corona'")).rows[0].id;
    await db.query(
      `INSERT INTO ordenes_trabajo (cliente_id, tipo_procedimiento_id, estado, created_at) VALUES
         ($1, $2, 'recibido',  '2026-10-30 21:30:00-05'),
         ($1, $2, 'entregado', '2026-10-31 08:00:00-05'),
         ($1, $2, 'recibido',  '2026-09-15 10:00:00-05')`,
      [c, corona]
    );

    const dia30 = await request(app).get('/api/reportes/ordenes?desde=2026-10-30&hasta=2026-10-30').set(auth);
    const octubre = await request(app).get('/api/reportes/ordenes?desde=2026-10-01&hasta=2026-10-31').set(auth);

    expect(dia30.status).toBe(200);
    expect(dia30.body.total).toBe(1);
    expect(octubre.body.total).toBe(2);
    expect(octubre.body.por_cliente).toEqual([
      expect.objectContaining({ cliente: 'Dra. Ríos', total: 2, estados: expect.objectContaining({ recibido: 1, entregado: 1 }) }),
    ]);
  });

  test('citas por semana: el domingo 11:30 p. m. pertenece a la semana que empieza el lunes anterior', async () => {
    const c = (await db.query("INSERT INTO clientes (nombre, tipo) VALUES ('Ana', 'paciente') RETURNING id")).rows[0].id;
    await db.query(
      `INSERT INTO citas (cliente_id, fecha_hora, motivo, estado) VALUES
         ($1, '2026-11-01 23:30:00-05', 'Entrega', 'pendiente'),
         ($1, '2026-11-02 00:15:00-05', 'Color', 'confirmada')`,
      [c]
    );

    const res = await request(app).get('/api/reportes/citas?desde=2026-10-26&hasta=2026-11-08').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.semanas.map((s) => [s.semana_inicio, s.total])).toEqual([
      ['2026-10-26', 1],
      ['2026-11-02', 1],
    ]);
  });

  test('consumo de insumos: suma solo las salidas y separa las de órdenes de las manuales', async () => {
    const yeso = (await db.query("INSERT INTO insumos (nombre, unidad, stock_actual) VALUES ('Yeso', 'g', 500) RETURNING id")).rows[0].id;
    await db.query(
      `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, created_at) VALUES
         ($1, 'salida', 30, '2026-10-10 10:00:00-05'),
         ($1, 'entrada', 99, '2026-10-11 10:00:00-05')`,
      [yeso]
    );

    const res = await request(app).get('/api/reportes/consumo-insumos?desde=2026-10-01&hasta=2026-10-31').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.insumos).toEqual([
      expect.objectContaining({ insumo: 'Yeso', total_consumido: 30, consumo_ordenes: 0, salidas_manuales: 30 }),
    ]);
  });
});
