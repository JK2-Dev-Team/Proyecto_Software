process.env.JWT_SECRET = 'secreto-de-prueba';

jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../src/db/connection');
const app = require('../src/app');
const { createUsuarioService } = require('../src/services/usuarioService');

const token = (rol = 'admin', id = 1) => jwt.sign({ id, rol, nombre: 'Test' }, 'secreto-de-prueba', { expiresIn: '1h' });

const admin = { id: 1, nombre: 'Miguel', email: 'miguel@x.com', rol: 'admin', activo: true };
const recepcion = { id: 2, nombre: 'Ana', email: 'ana@x.com', rol: 'recepcionista', activo: true };

function armar() {
  const fakeDb = { query: jest.fn() };
  return { fakeDb, usuarios: createUsuarioService({ db: fakeDb, rondas: 4 }) };
}

describe('listar', () => {
  test('nunca pide ni devuelve la contraseña', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query.mockResolvedValueOnce({ rows: [admin, recepcion] });
    const r = await usuarios.listar();
    expect(r).toHaveLength(2);
    expect(fakeDb.query.mock.calls[0][0]).not.toMatch(/password/);
  });
});

describe('crear', () => {
  const datos = { nombre: '  Laura  ', email: 'LAURA@X.com', password: 'ClaveSegura1', rol: 'recepcionista' };

  test('guarda la contraseña cifrada, normaliza nombre y correo, y no devuelve el hash', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query.mockResolvedValueOnce({ rows: [{ id: 5, nombre: 'Laura', email: 'laura@x.com', rol: 'recepcionista', activo: true }] });
    const r = await usuarios.crear(datos);

    const [sql, params] = fakeDb.query.mock.calls[0];
    expect(params[0]).toBe('Laura');
    expect(params[1]).toBe('laura@x.com');
    expect(params[2]).not.toBe('ClaveSegura1');
    expect(await bcrypt.compare('ClaveSegura1', params[2])).toBe(true);
    expect(sql).toMatch(/RETURNING id, nombre, email, rol, activo, created_at/);
    expect(r).not.toHaveProperty('password_hash');
  });

  test.each([
    [{ nombre: '' }, /nombre/],
    [{ email: 'no-es-correo' }, /email/],
    [{ password: 'corta' }, /8 caracteres/],
    [{ password: 'a'.repeat(73) }, /72/],
    [{ password: 12345678 }, /8 caracteres/],
    [{ rol: 'superusuario' }, /rol inválido/],
  ])('rechaza datos inválidos %j con 400 y sin tocar la base de datos', async (cambio, mensaje) => {
    const { fakeDb, usuarios } = armar();
    await expect(usuarios.crear({ ...datos, ...cambio })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(mensaje) });
    expect(fakeDb.query).not.toHaveBeenCalled();
  });
});

describe('actualizar', () => {
  test('exige al menos un dato y valida cada uno', async () => {
    const { fakeDb, usuarios } = armar();
    await expect(usuarios.actualizar(1, 2, {})).rejects.toMatchObject({ status: 400 });
    await expect(usuarios.actualizar(1, 2, { activo: 'no' })).rejects.toMatchObject({ status: 400 });
    await expect(usuarios.actualizar(1, 2, { rol: 'root' })).rejects.toMatchObject({ status: 400 });
    await expect(usuarios.actualizar(1, 'abc', { nombre: 'X' })).rejects.toMatchObject({ status: 400 });
    expect(fakeDb.query).not.toHaveBeenCalled();
  });

  test('usuario inexistente: 404', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query.mockResolvedValueOnce({ rows: [] });
    await expect(usuarios.actualizar(1, 99, { nombre: 'X' })).rejects.toMatchObject({ status: 404 });
  });

  test('cambia solo lo indicado y conserva el resto', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query
      .mockResolvedValueOnce({ rows: [recepcion] })
      .mockResolvedValueOnce({ rows: [{ ...recepcion, nombre: 'Ana María' }] });
    const r = await usuarios.actualizar(1, 2, { nombre: 'Ana María' });
    expect(fakeDb.query.mock.calls[1][1]).toEqual(['Ana María', 'recepcionista', true, 2]);
    expect(r.nombre).toBe('Ana María');
  });

  test('desactivar a una recepcionista no consulta administradores suplentes', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query
      .mockResolvedValueOnce({ rows: [recepcion] })
      .mockResolvedValueOnce({ rows: [{ ...recepcion, activo: false }] });
    await usuarios.actualizar(1, 2, { activo: false });
    expect(fakeDb.query).toHaveBeenCalledTimes(2);
  });

  test('nadie puede desactivarse a sí mismo ni quitarse el rol de administrador', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query.mockResolvedValue({ rows: [admin] });
    await expect(usuarios.actualizar(1, 1, { activo: false })).rejects.toMatchObject({ status: 409, message: /propia cuenta/ });
    await expect(usuarios.actualizar(1, 1, { rol: 'recepcionista' })).rejects.toMatchObject({ status: 409, message: /propio rol/ });
  });

  test('no deja el sistema sin administradores activos', async () => {
    const { fakeDb, usuarios } = armar();
    // El actor es un administrador con token aún vigente (id 9) y el objetivo es el único administrador activo (id 1)
    fakeDb.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [{ n: 0 }] });
    await expect(usuarios.actualizar(9, 1, { activo: false })).rejects.toMatchObject({ status: 409, message: /al menos un administrador/ });
    expect(fakeDb.query).toHaveBeenCalledTimes(2); // nunca llegó al UPDATE
  });

  test('sí permite quitar el rol de administrador si queda otro activo', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [{ n: 1 }] })
      .mockResolvedValueOnce({ rows: [{ ...admin, rol: 'recepcionista' }] });
    const r = await usuarios.actualizar(9, 1, { rol: 'recepcionista' });
    expect(r.rol).toBe('recepcionista');
  });
});

describe('restablecerPassword', () => {
  test('guarda el hash de la nueva contraseña', async () => {
    const { fakeDb, usuarios } = armar();
    fakeDb.query.mockResolvedValueOnce({ rowCount: 1 });
    await usuarios.restablecerPassword(2, 'NuevaClave123');
    const [, params] = fakeDb.query.mock.calls[0];
    expect(await bcrypt.compare('NuevaClave123', params[0])).toBe(true);
    expect(params[1]).toBe(2);
  });

  test('contraseña inválida: 400 sin tocar la base; usuario inexistente: 404', async () => {
    const { fakeDb, usuarios } = armar();
    await expect(usuarios.restablecerPassword(2, 'corta')).rejects.toMatchObject({ status: 400 });
    expect(fakeDb.query).not.toHaveBeenCalled();
    fakeDb.query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(usuarios.restablecerPassword(99, 'NuevaClave123')).rejects.toMatchObject({ status: 404 });
  });
});

describe('rutas HTTP /api/usuarios', () => {
  beforeEach(() => db.query.mockReset());
  const auth = (rol) => ({ Authorization: `Bearer ${token(rol)}` });

  test('sin sesión: 401 en las cuatro rutas', async () => {
    expect((await request(app).get('/api/usuarios')).status).toBe(401);
    expect((await request(app).post('/api/usuarios').send({})).status).toBe(401);
    expect((await request(app).patch('/api/usuarios/2').send({})).status).toBe(401);
    expect((await request(app).put('/api/usuarios/2/password').send({})).status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('una recepcionista recibe 403 en las cuatro rutas', async () => {
    const h = auth('recepcionista');
    expect((await request(app).get('/api/usuarios').set(h)).status).toBe(403);
    expect((await request(app).post('/api/usuarios').set(h).send({})).status).toBe(403);
    expect((await request(app).patch('/api/usuarios/2').set(h).send({ rol: 'admin' })).status).toBe(403);
    expect((await request(app).put('/api/usuarios/2/password').set(h).send({ password: 'ClaveSegura1' })).status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('una ruta inexistente sigue respondiendo 404, no 401', async () => {
    expect((await request(app).get('/api/usuarios/2/otra')).status).toBe(404);
  });

  test('el administrador lista usuarios', async () => {
    db.query.mockResolvedValueOnce({ rows: [admin, recepcion] });
    const res = await request(app).get('/api/usuarios').set(auth('admin'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/password/);
  });

  test('crear: 201 y, con un correo repetido, 409 con mensaje claro', async () => {
    const cuerpo = { nombre: 'Laura', email: 'laura@x.com', password: 'ClaveSegura1', rol: 'recepcionista' };
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, nombre: 'Laura', email: 'laura@x.com', rol: 'recepcionista', activo: true }] });
    const ok = await request(app).post('/api/usuarios').set(auth('admin')).send(cuerpo);
    expect(ok.status).toBe(201);
    expect(ok.body).not.toHaveProperty('password');

    db.query.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const repetido = await request(app).post('/api/usuarios').set(auth('admin')).send(cuerpo);
    expect(repetido.status).toBe(409);
  });

  test('editar: usa el id del token como actor (no puede desactivarse a sí mismo)', async () => {
    db.query.mockResolvedValueOnce({ rows: [admin] });
    const res = await request(app).patch('/api/usuarios/1').set({ Authorization: `Bearer ${token('admin', 1)}` }).send({ activo: false });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/propia cuenta/);
  });

  test('restablecer contraseña: 204 sin cuerpo; sin contraseña: 400', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1 });
    const ok = await request(app).put('/api/usuarios/2/password').set(auth('admin')).send({ password: 'ClaveSegura1' });
    expect(ok.status).toBe(204);
    expect(ok.text).toBe('');

    const mal = await request(app).put('/api/usuarios/2/password').set(auth('admin')).send({});
    expect(mal.status).toBe(400);
  });
});
