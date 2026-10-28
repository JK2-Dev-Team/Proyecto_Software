jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const db = require('../src/db/connection');
const clientes = require('../src/services/clientes.service');

beforeEach(() => db.query.mockReset());

describe('validarCliente', () => {
  test('rechaza cliente sin nombre', () => {
    expect(() => clientes.validarCliente({ tipo: 'paciente' })).toThrow('nombre es obligatorio');
  });

  test('rechaza tipo inválido', () => {
    expect(() => clientes.validarCliente({ nombre: 'Ana', tipo: 'proveedor' })).toThrow(/tipo inválido/);
  });

  test('normaliza campos opcionales vacíos a null', () => {
    expect(clientes.validarCliente({ nombre: ' Ana ', tipo: 'paciente', telefono: '' })).toEqual({
      nombre: 'Ana',
      tipo: 'paciente',
      telefono: null,
      email: null,
    });
  });
});

describe('operaciones', () => {
  test('obtener lanza 404 si no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(clientes.obtener(7)).rejects.toMatchObject({ status: 404 });
  });

  test('crear devuelve el cliente insertado', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, nombre: 'Dr. Pérez', tipo: 'odontologo' }] });
    const c = await clientes.crear({ nombre: 'Dr. Pérez', tipo: 'odontologo' });
    expect(c.id).toBe(1);
  });

  test('actualizar lanza 404 si el cliente no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(clientes.actualizar(7, { nombre: 'X', tipo: 'paciente' })).rejects.toMatchObject({ status: 404 });
  });

  test('listar rechaza un tipo inválido', async () => {
    await expect(clientes.listar({ tipo: 'otro' })).rejects.toMatchObject({ status: 400 });
  });
});
