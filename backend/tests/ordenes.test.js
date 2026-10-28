// Corre sin dependencias: node --test test/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { puedeTransitar } = require('../src/patterns/estadosOrden');
const { calcularConsumo } = require('../src/patterns/consumoStrategies');
const { StockSubject, AlertaStockBajoObserver } = require('../src/patterns/stockSubject');
const { createInventarioService } = require('../src/services/inventarioService');
const { createOrdenService } = require('../src/services/ordenService');

// BD simulada en memoria con soporte mínimo de transacciones (snapshot/rollback).
function fakeDb({ orden, receta, insumos }) {
  const state = { orden: { ...orden }, insumos: JSON.parse(JSON.stringify(insumos)), movs: [], historial: [], alertas: [] };
  let snap = null;
  const run = async (sql, p = []) => {
    if (sql === 'BEGIN') { snap = JSON.stringify(state); return { rows: [] }; }
    if (sql === 'ROLLBACK') { Object.assign(state, JSON.parse(snap)); return { rows: [] }; }
    if (sql === 'COMMIT') return { rows: [] };
    if (/FROM ordenes_trabajo WHERE id = \$1 FOR UPDATE/.test(sql)) return { rows: state.orden.id == p[0] ? [{ ...state.orden }] : [] };
    if (/FROM procedimiento_insumos/.test(sql)) return { rows: receta };
    if (/UPDATE insumos SET stock_actual/.test(sql)) {
      const i = state.insumos.find((x) => x.id == p[0]);
      if (!i || Number(i.stock_actual) + p[1] < 0) return { rows: [] };
      i.stock_actual = Number(i.stock_actual) + p[1];
      return { rows: [{ ...i }] };
    }
    if (/SELECT nombre, stock_actual FROM insumos/.test(sql)) return { rows: state.insumos.filter((x) => x.id == p[0]) };
    if (/INSERT INTO movimientos_inventario/.test(sql)) { state.movs.push(p); return { rows: [] }; }
    if (/SET insumos_descontados = TRUE/.test(sql)) { state.orden.insumos_descontados = true; return { rows: [] }; }
    if (/UPDATE ordenes_trabajo SET estado/.test(sql)) { state.orden.estado = p[1]; return { rows: [{ ...state.orden }] }; }
    if (/INSERT INTO orden_historial_estados/.test(sql)) { state.historial.push(p); return { rows: [] }; }
    if (/INSERT INTO alertas_stock/.test(sql)) { state.alertas.push({ insumo_id: p[0], abierta: true }); return { rows: [] }; }
    if (/UPDATE alertas_stock SET abierta = FALSE/.test(sql)) { state.alertas.forEach((a) => a.insumo_id == p[0] && (a.abierta = false)); return { rows: [] }; }
    throw new Error('SQL no soportado en el fake: ' + sql);
  };
  const client = { query: run, release() {} };
  return { state, query: run, getPool: () => ({ connect: async () => client }) };
}

function armar(opts) {
  const db = fakeDb(opts);
  const subject = new StockSubject();
  subject.subscribe(new AlertaStockBajoObserver(db));
  const inventario = createInventarioService({ db, subject });
  const ordenes = createOrdenService({ db, inventario, subject });
  return { db, ordenes, inventario };
}

const base = () => ({
  orden: { id: 1, estado: 'recibido', unidades: 3, tipo_procedimiento_id: 7, insumos_descontados: false },
  receta: [
    { insumo_id: 10, cantidad: '2', modo_consumo: 'por_unidad' }, // 6
    { insumo_id: 11, cantidad: '1', modo_consumo: 'fijo' },       // 1
  ],
  insumos: [
    { id: 10, nombre: 'Cerámica', stock_actual: 20, stock_minimo: 10 },
    { id: 11, nombre: 'Revestimiento', stock_actual: 5, stock_minimo: 1 },
  ],
});

test('transiciones válidas e inválidas', () => {
  assert.equal(puedeTransitar('recibido', 'modelado'), true);
  assert.equal(puedeTransitar('recibido', 'terminado'), false);
  assert.equal(puedeTransitar('control_calidad', 'coccion_acabado'), true); // retrabajo
  assert.equal(puedeTransitar('entregado', 'recibido'), false);
});

test('Strategy: por_unidad vs fijo', () => {
  assert.equal(calcularConsumo({ cantidad: '2', modo_consumo: 'por_unidad' }, 3), 6);
  assert.equal(calcularConsumo({ cantidad: '2', modo_consumo: 'fijo' }, 3), 2);
  assert.throws(() => calcularConsumo({ cantidad: 1, modo_consumo: 'xx' }, 1));
});

test('pasar a "modelado" descuenta insumos (por_unidad y fijo) sin alerta si queda sobre el mínimo', async () => {
  const { db, ordenes } = armar(base());
  const r = await ordenes.cambiarEstado(1, 'modelado', { id: 99 });
  assert.equal(r.estado, 'modelado');
  assert.equal(db.state.insumos[0].stock_actual, 14); // 20 - 6
  assert.equal(db.state.insumos[1].stock_actual, 4);  // 5 - 1
  assert.equal(db.state.movs.length, 2);
  assert.equal(db.state.alertas.length, 0);           // 14 > 10, 4 > 1
});

test('Observer: alerta de stock bajo cuando el consumo cruza el mínimo', async () => {
  const o = base();
  o.insumos[0].stock_actual = 12; // 12 - 6 = 6 <= 10
  const { db, ordenes } = armar(o);
  await ordenes.cambiarEstado(1, 'modelado', { id: 1 });
  assert.equal(db.state.alertas.length, 1);
  assert.equal(db.state.alertas[0].insumo_id, 10);
});

test('stock insuficiente: revierte todo y no cambia el estado', async () => {
  const o = base();
  o.insumos[1].stock_actual = 0; // el segundo insumo falla tras descontar el primero
  const { db, ordenes } = armar(o);
  await assert.rejects(() => ordenes.cambiarEstado(1, 'modelado', { id: 1 }), { status: 409 });
  assert.equal(db.state.orden.estado, 'recibido');
  assert.equal(db.state.insumos[0].stock_actual, 20); // rollback del primer descuento
  assert.equal(db.state.movs.length, 0);
  assert.equal(db.state.alertas.length, 0);
});

test('transición inválida responde 409 y no toca inventario', async () => {
  const { db, ordenes } = armar(base());
  await assert.rejects(() => ordenes.cambiarEstado(1, 'terminado', { id: 1 }), { status: 409 });
  assert.equal(db.state.movs.length, 0);
});

test('el descuento ocurre una sola vez aunque haya retrabajo', async () => {
  const o = base();
  o.orden.estado = 'control_calidad';
  o.orden.insumos_descontados = true;
  const { db, ordenes } = armar(o);
  await ordenes.cambiarEstado(1, 'coccion_acabado', { id: 1 });
  assert.equal(db.state.movs.length, 0);
});

test('orden inexistente responde 404', async () => {
  const { ordenes } = armar(base());
  await assert.rejects(() => ordenes.cambiarEstado(999, 'modelado', {}), { status: 404 });
});

test('Observer: la alerta se cierra cuando una entrada recupera el stock', async () => {
  const { db, inventario } = armar({ ...base(), insumos: [{ id: 10, nombre: 'Cerámica', stock_actual: 3, stock_minimo: 10 }] });
  await inventario.registrarMovimiento({ insumo_id: 10, tipo: 'salida', cantidad: 1 });
  assert.equal(db.state.alertas.filter((a) => a.abierta).length, 1);
  await inventario.registrarMovimiento({ insumo_id: 10, tipo: 'entrada', cantidad: 50 });
  assert.equal(db.state.alertas.filter((a) => a.abierta).length, 0);
});

test('movimiento inválido: cantidad 0 o negativa en salida', async () => {
  const { inventario } = armar(base());
  await assert.rejects(() => inventario.registrarMovimiento({ insumo_id: 10, tipo: 'salida', cantidad: 0 }), { status: 400 });
  await assert.rejects(() => inventario.registrarMovimiento({ insumo_id: 10, tipo: 'salida', cantidad: -2 }), { status: 400 });
});
