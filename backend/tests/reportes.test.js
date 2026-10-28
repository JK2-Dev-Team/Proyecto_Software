process.env.JWT_SECRET = 'secreto-de-prueba';

jest.mock('../src/db/connection', () => ({ query: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db/connection');
const app = require('../src/app');
const { createReporteService, resolverPeriodo, lunesDe } = require('../src/services/reporteService');

const token = (rol = 'recepcionista') => jwt.sign({ id: 1, rol, nombre: 'Test' }, 'secreto-de-prueba', { expiresIn: '1h' });

// 03:00 UTC del 29 de octubre = 10:00 p. m. del 28 de octubre en Bogotá (UTC-5)
const AHORA = () => new Date('2026-10-29T03:00:00Z');

function armar(filas = []) {
  const fakeDb = { query: jest.fn().mockResolvedValue({ rows: filas }) };
  return { fakeDb, reportes: createReporteService({ db: fakeDb, ahora: AHORA }) };
}

describe('períodos y fechas', () => {
  test('sin parámetros: últimos 30 días hasta hoy, con "hoy" calculado en hora de Bogotá', () => {
    // En UTC ya sería 29 de octubre, pero en Colombia todavía es 28
    expect(resolverPeriodo({}, '2026-10-28')).toEqual({ desde: '2026-09-29', hasta: '2026-10-28' });
  });

  test('el servicio usa la hora de Colombia para decidir qué día es hoy', async () => {
    const { fakeDb, reportes } = armar();
    await reportes.ordenes({});
    expect(fakeDb.query.mock.calls[0][1]).toEqual(['2026-09-29', '2026-10-28', 'America/Bogota']);
  });

  test('solo "desde": termina hoy; solo "hasta": empieza 29 días antes', () => {
    expect(resolverPeriodo({ desde: '2026-10-01' }, '2026-10-28')).toEqual({ desde: '2026-10-01', hasta: '2026-10-28' });
    expect(resolverPeriodo({ hasta: '2026-10-31' }, '2026-10-28')).toEqual({ desde: '2026-10-02', hasta: '2026-10-31' });
  });

  test.each([
    [{ desde: '28/10/2026' }, /desde/],
    [{ desde: '2026-13-01' }, /desde/],
    [{ hasta: '2026-02-30' }, /hasta/], // fecha imposible
    [{ desde: 'hoy' }, /desde/],
    [{ desde: '2026-10-20', hasta: '2026-10-01' }, /posterior/],
    [{ desde: '2024-01-01', hasta: '2026-10-28' }, /366/],
  ])('rechaza %j con 400', (query, mensaje) => {
    expect(() => resolverPeriodo(query, '2026-10-28')).toThrow(mensaje);
    try { resolverPeriodo(query, '2026-10-28'); } catch (e) { expect(e.status).toBe(400); }
  });

  test('un período inválido no llega a consultar la base de datos', async () => {
    const { fakeDb, reportes } = armar();
    await expect(reportes.citasSemanales({ desde: 'mañana' })).rejects.toMatchObject({ status: 400 });
    expect(fakeDb.query).not.toHaveBeenCalled();
  });

  test('lunesDe: las semanas van de lunes a domingo', () => {
    expect(lunesDe('2026-10-26')).toBe('2026-10-26'); // lunes
    expect(lunesDe('2026-10-28')).toBe('2026-10-26'); // miércoles
    expect(lunesDe('2026-11-01')).toBe('2026-10-26'); // domingo
    expect(lunesDe('2026-11-02')).toBe('2026-11-02'); // siguiente lunes
  });
});

describe('reporte de órdenes', () => {
  const filas = [
    { cliente_id: 1, cliente: 'Dra. Ríos', estado: 'recibido', total: 2 },
    { cliente_id: 1, cliente: 'Dra. Ríos', estado: 'entregado', total: 1 },
    { cliente_id: 2, cliente: 'Dr. Álvarez', estado: 'en_modelado', total: '5' }, // pg puede devolver texto
    { cliente_id: 3, cliente: 'Ana Pérez', estado: 'recibido', total: 3 },
  ];

  test('cuenta por estado (con todos los estados, aun en cero) y en el orden del ciclo de vida', async () => {
    const { reportes } = armar(filas);
    const r = await reportes.ordenes({});
    expect(r.total).toBe(11);
    expect(r.por_estado.map((e) => e.estado)).toEqual([
      'recibido', 'en_modelado', 'en_coccion_acabado', 'control_calidad', 'terminado', 'entregado',
    ]);
    expect(r.por_estado.map((e) => e.total)).toEqual([5, 5, 0, 0, 0, 1]);
  });

  test('agrupa por cliente, de más a menos órdenes, desempatando por nombre', async () => {
    const { reportes } = armar(filas);
    const r = await reportes.ordenes({});
    expect(r.por_cliente.map((c) => [c.cliente, c.total])).toEqual([
      ['Dr. Álvarez', 5],
      ['Ana Pérez', 3],
      ['Dra. Ríos', 3],
    ]);
    const rios = r.por_cliente.find((c) => c.cliente_id === 1);
    expect(rios.estados).toMatchObject({ recibido: 2, entregado: 1, en_modelado: 0 });
  });

  test('sin órdenes devuelve ceros y listas vacías, no un error', async () => {
    const { reportes } = armar([]);
    const r = await reportes.ordenes({});
    expect(r.total).toBe(0);
    expect(r.por_cliente).toEqual([]);
    expect(r.por_estado).toHaveLength(6);
  });
});

describe('reporte de consumo de insumos', () => {
  test('convierte los NUMERIC de PostgreSQL (texto) a número y ordena de mayor a menor consumo', async () => {
    const { reportes } = armar([
      { insumo_id: 1, insumo: 'Yeso', unidad: 'g', total_consumido: '150.50', consumo_ordenes: '150.50', salidas_manuales: '0', ordenes: 4 },
      { insumo_id: 2, insumo: 'Cerámica', unidad: 'g', total_consumido: '300', consumo_ordenes: '280', salidas_manuales: '20', ordenes: '6' },
    ]);
    const r = await reportes.consumoInsumos({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(r.periodo).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(r.insumos.map((i) => i.insumo)).toEqual(['Cerámica', 'Yeso']);
    expect(r.insumos[0]).toEqual({
      insumo_id: 2, insumo: 'Cerámica', unidad: 'g',
      total_consumido: 300, consumo_ordenes: 280, salidas_manuales: 20, ordenes: 6,
    });
  });

  test('solo consulta salidas: la consulta filtra por tipo = salida', async () => {
    const { fakeDb, reportes } = armar([]);
    await reportes.consumoInsumos({});
    expect(fakeDb.query.mock.calls[0][0]).toMatch(/m\.tipo = 'salida'/);
  });
});

describe('reporte de citas por semana', () => {
  test('incluye todas las semanas del período, también las vacías, de lunes a domingo', async () => {
    const { reportes } = armar([
      { semana_inicio: '2026-10-26', estado: 'confirmada', total: 3 },
      { semana_inicio: '2026-10-26', estado: 'cancelada', total: 1 },
      { semana_inicio: '2026-11-09', estado: 'pendiente', total: '2' },
    ]);
    const r = await reportes.citasSemanales({ desde: '2026-10-28', hasta: '2026-11-10' });

    expect(r.semanas.map((s) => [s.semana_inicio, s.semana_fin])).toEqual([
      ['2026-10-26', '2026-11-01'],
      ['2026-11-02', '2026-11-08'], // semana sin citas
      ['2026-11-09', '2026-11-15'],
    ]);
    expect(r.semanas[0]).toMatchObject({ total: 4, confirmada: 3, cancelada: 1, pendiente: 0, completada: 0 });
    expect(r.semanas[1]).toMatchObject({ total: 0, confirmada: 0 });
    expect(r.semanas[2]).toMatchObject({ total: 2, pendiente: 2 });
    expect(r.total).toBe(6);
  });

  test('un período de un solo día devuelve su semana', async () => {
    const { reportes } = armar([]);
    const r = await reportes.citasSemanales({ desde: '2026-10-28', hasta: '2026-10-28' });
    expect(r.semanas).toHaveLength(1);
    expect(r.semanas[0].semana_inicio).toBe('2026-10-26');
  });
});

describe('rutas HTTP', () => {
  beforeEach(() => db.query.mockReset());

  test.each(['ordenes', 'consumo-insumos', 'citas'])('/api/reportes/%s exige sesión iniciada (401)', async (ruta) => {
    const res = await request(app).get(`/api/reportes/${ruta}`);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('una ruta de reportes que no existe sigue respondiendo 404 (no 401)', async () => {
    const res = await request(app).get('/api/reportes/no-existe');
    expect(res.status).toBe(404);
  });

  test('con sesión devuelve el reporte de órdenes', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ cliente_id: 1, cliente: 'Dra. Ríos', estado: 'recibido', total: 2 }] });
    const res = await request(app).get('/api/reportes/ordenes?desde=2026-10-01&hasta=2026-10-31').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.periodo).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
  });

  test('con sesión devuelve el consumo de insumos y las citas', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const consumo = await request(app).get('/api/reportes/consumo-insumos').set('Authorization', `Bearer ${token('admin')}`);
    expect(consumo.status).toBe(200);
    expect(consumo.body.insumos).toEqual([]);

    db.query.mockResolvedValueOnce({ rows: [] });
    const citas = await request(app).get('/api/reportes/citas?desde=2026-10-26&hasta=2026-11-01').set('Authorization', `Bearer ${token()}`);
    expect(citas.status).toBe(200);
    expect(citas.body.semanas).toHaveLength(1);
  });

  test('fechas inválidas responden 400 con un mensaje claro', async () => {
    const res = await request(app).get('/api/reportes/citas?desde=ayer').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/desde/);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('un fallo de la base de datos responde 500 genérico, sin filtrar detalles', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.query.mockRejectedValueOnce(new Error('connection to server at "db.supabase.co" failed'));
    const res = await request(app).get('/api/reportes/ordenes').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/supabase/);
    console.error.mockRestore();
  });
});
