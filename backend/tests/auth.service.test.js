process.env.JWT_SECRET = 'secreto-de-prueba';

jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/db/connection');
const auth = require('../src/services/auth.service');

const usuarioDb = {
  id: 1,
  nombre: 'Miguel Torres',
  email: 'miguel@ejemplo.com',
  password_hash: bcrypt.hashSync('ClaveSegura123', 4),
  rol: 'admin',
  activo: true,
};

beforeEach(() => {
  db.query.mockReset();
});

describe('login', () => {
  test('exige email y contraseña', async () => {
    await expect(auth.login({ email: 'a@b.com' })).rejects.toMatchObject({ status: 400 });
  });

  test('devuelve token JWT y datos del usuario con credenciales correctas', async () => {
    db.query.mockResolvedValueOnce({ rows: [usuarioDb] });
    const resultado = await auth.login({ email: 'MIGUEL@ejemplo.com', password: 'ClaveSegura123' });

    const payload = jwt.verify(resultado.token, 'secreto-de-prueba');
    expect(payload).toMatchObject({ id: 1, rol: 'admin' });
    expect(resultado.usuario).not.toHaveProperty('password_hash');
    expect(db.query.mock.calls[0][1]).toEqual(['miguel@ejemplo.com']); // email normalizado
  });

  test('rechaza contraseña incorrecta con 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [usuarioDb] });
    await expect(auth.login({ email: 'miguel@ejemplo.com', password: 'otra' })).rejects.toMatchObject({ status: 401 });
  });

  test('rechaza usuario inexistente con el mismo 401 genérico', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(auth.login({ email: 'nadie@ejemplo.com', password: 'x' })).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas',
    });
  });

  test('rechaza usuarios desactivados', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...usuarioDb, activo: false }] });
    await expect(auth.login({ email: 'miguel@ejemplo.com', password: 'ClaveSegura123' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('registrar', () => {
  const datos = { nombre: 'Ana', email: 'ana@ejemplo.com', password: 'ClaveSegura123', rol: 'recepcionista' };

  test('rechaza contraseñas cortas', async () => {
    await expect(auth.registrar({ ...datos, password: '123' })).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza roles inválidos', async () => {
    await expect(auth.registrar({ ...datos, rol: 'superusuario' })).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza emails con formato inválido', async () => {
    await expect(auth.registrar({ ...datos, email: 'sin-arroba' })).rejects.toMatchObject({ status: 400 });
  });

  test('guarda la contraseña encriptada con bcrypt, nunca en texto plano', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'recepcionista' }] });
    await auth.registrar(datos);
    const hashGuardado = db.query.mock.calls[0][1][2];
    expect(hashGuardado).not.toBe(datos.password);
    expect(await bcrypt.compare(datos.password, hashGuardado)).toBe(true);
  });
});
