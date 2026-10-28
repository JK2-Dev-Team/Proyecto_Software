jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const db = require('../src/db/connection');
const citas = require('../src/services/citas.service');

const citaBase = {
  id: 1,
  cliente_id: 3,
  cliente_nombre: 'Dr. Pérez',
  fecha_hora: new Date('2026-11-10T14:00:00.000Z'),
  motivo: 'Prueba de corona',
  estado: 'pendiente',
  notas: null,
};

beforeEach(() => {
  db.query.mockReset();
});

describe('puedeTransicionar', () => {
  test.each([
    ['pendiente', 'confirmada', true],
    ['pendiente', 'cancelada', true],
    ['pendiente', 'completada', false],
    ['confirmada', 'completada', true],
    ['confirmada', 'pendiente', false],
    ['completada', 'cancelada', false],
    ['cancelada', 'pendiente', false],
  ])('%s -> %s = %s', (de, a, esperado) => {
    expect(citas.puedeTransicionar(de, a)).toBe(esperado);
  });
});

describe('crear', () => {
  const datosValidos = { cliente_id: 3, fecha_hora: '2026-11-10T14:00:00Z', motivo: 'Prueba de corona' };

  test('rechaza cita sin cliente_id', async () => {
    await expect(citas.crear({ ...datosValidos, cliente_id: undefined }, 1)).rejects.toMatchObject({ status: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rechaza fecha inválida', async () => {
    await expect(citas.crear({ ...datosValidos, fecha_hora: 'no-es-fecha' }, 1)).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza cita sin motivo', async () => {
    await expect(citas.crear({ ...datosValidos, motivo: '  ' }, 1)).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza cita duplicada con 409', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] }); // existeDuplicada
    await expect(citas.crear(datosValidos, 1)).rejects.toMatchObject({ status: 409 });
  });

  test('crea la cita cuando los datos son válidos y no hay duplicado', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // existeDuplicada
      .mockResolvedValueOnce({ rows: [{ id: 5, estado: 'pendiente' }] }); // INSERT
    const cita = await citas.crear(datosValidos, 1);
    expect(cita).toEqual({ id: 5, estado: 'pendiente' });
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});

describe('obtener', () => {
  test('lanza 404 si la cita no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(citas.obtener(99)).rejects.toMatchObject({ status: 404 });
  });

  test('lanza 400 si el id no es válido', async () => {
    await expect(citas.obtener('abc')).rejects.toMatchObject({ status: 400 });
  });
});

describe('listar', () => {
  test('rechaza un estado inexistente', async () => {
    await expect(citas.listar({ estado: 'volando' })).rejects.toMatchObject({ status: 400 });
  });

  test('construye filtros dinámicos con parámetros', async () => {
    db.query.mockResolvedValueOnce({ rows: [citaBase] });
    await citas.listar({ estado: 'pendiente', cliente_id: '3' });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('c.estado = $1');
    expect(sql).toContain('c.cliente_id = $2');
    expect(params).toEqual(['pendiente', 3]);
  });
});

describe('actualizar', () => {
  test('no permite editar una cita cancelada', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...citaBase, estado: 'cancelada' }] });
    await expect(citas.actualizar(1, { motivo: 'Otro' })).rejects.toMatchObject({ status: 409 });
  });

  test('actualiza solo los campos enviados y mantiene el resto', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [citaBase] }) // obtener
      .mockResolvedValueOnce({ rows: [{ ...citaBase, motivo: 'Ajuste' }] }); // UPDATE
    await citas.actualizar(1, { motivo: 'Ajuste' });
    const [, params] = db.query.mock.calls[1];
    expect(params[0]).toBe(3); // cliente_id intacto
    expect(params[2]).toBe('Ajuste');
  });
});

describe('cambiarEstado', () => {
  test('rechaza un estado inválido', async () => {
    await expect(citas.cambiarEstado(1, 'inventado')).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza una transición no permitida', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...citaBase, estado: 'completada' }] });
    await expect(citas.cambiarEstado(1, 'pendiente')).rejects.toMatchObject({ status: 409 });
  });

  test('acepta pendiente -> confirmada', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [citaBase] })
      .mockResolvedValueOnce({ rows: [{ ...citaBase, estado: 'confirmada' }] });
    const cita = await citas.cambiarEstado(1, 'confirmada');
    expect(cita.estado).toBe('confirmada');
  });
});
