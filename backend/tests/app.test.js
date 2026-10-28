process.env.JWT_SECRET = 'secreto-de-prueba';

jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../src/db/connection');
const app = require('../src/app');

const token = (rol) => jwt.sign({ id: 1, rol, nombre: 'Test' }, 'secreto-de-prueba', { expiresIn: '1h' });

beforeEach(() => db.query.mockReset());

describe('integración de rutas y middlewares', () => {
  test('GET /api/health responde ok sin autenticación', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('rutas protegidas devuelven 401 sin token', async () => {
    const res = await request(app).get('/api/citas');
    expect(res.status).toBe(401);
  });

  test('rutas protegidas devuelven 401 con token inválido', async () => {
    const res = await request(app).get('/api/citas').set('Authorization', 'Bearer basura');
    expect(res.status).toBe(401);
  });

  test('un recepcionista NO puede registrar usuarios (403)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('recepcionista')}`)
      .send({ nombre: 'X', email: 'x@x.com', password: '12345678', rol: 'admin' });
    expect(res.status).toBe(403);
  });

  test('un admin sí puede registrar usuarios (201)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Ana', email: 'ana@x.com', rol: 'recepcionista' }] });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ nombre: 'Ana', email: 'ana@x.com', password: '12345678', rol: 'recepcionista' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('login por HTTP devuelve token', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'M', email: 'm@x.com', password_hash: bcrypt.hashSync('ClaveSegura1', 4), rol: 'admin', activo: true }],
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'm@x.com', password: 'ClaveSegura1' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  test('con token válido, listar citas llega al servicio y devuelve JSON', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, motivo: 'Corona' }] });
    const res = await request(app).get('/api/citas').set('Authorization', `Bearer ${token('recepcionista')}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('errores de validación se devuelven como 400 con mensaje claro', async () => {
    const res = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${token('recepcionista')}`)
      .send({ motivo: 'sin cliente' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cliente_id/);
  });

  test('un fallo inesperado de la base de datos no filtra detalles (500 genérico)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.query.mockRejectedValueOnce(new Error('password authentication failed for user "postgres"'));
    const res = await request(app).get('/api/citas').set('Authorization', `Bearer ${token('admin')}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno del servidor');
    expect(JSON.stringify(res.body)).not.toMatch(/postgres/);
    console.error.mockRestore();
  });

  test('ruta inexistente devuelve 404', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });
});
