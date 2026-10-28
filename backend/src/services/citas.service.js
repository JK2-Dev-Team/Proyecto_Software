const db = require('../db/connection');
const AppError = require('../utils/AppError');
const { parseId, textoRequerido, textoOpcional, fechaValida } = require('../utils/validators');

const ESTADOS = ['pendiente', 'confirmada', 'completada', 'cancelada'];

// Flujo permitido de estados de una cita
const TRANSICIONES = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};

const ESTADOS_EDITABLES = ['pendiente', 'confirmada'];

const BASE_SELECT = `
  SELECT c.id, c.cliente_id, cl.nombre AS cliente_nombre, c.fecha_hora, c.motivo,
         c.estado, c.notas, c.created_at, c.updated_at
  FROM citas c
  JOIN clientes cl ON cl.id = c.cliente_id`;

function puedeTransicionar(estadoActual, estadoNuevo) {
  return (TRANSICIONES[estadoActual] || []).includes(estadoNuevo);
}

// Evita duplicidad: mismo cliente, misma fecha/hora y cita aún activa
async function existeDuplicada(clienteId, fecha, excluirId = null) {
  const { rows } = await db.query(
    `SELECT id FROM citas
     WHERE cliente_id = $1 AND fecha_hora = $2 AND estado <> 'cancelada'
       AND ($3::int IS NULL OR id <> $3)
     LIMIT 1`,
    [clienteId, fecha.toISOString(), excluirId]
  );
  return rows.length > 0;
}

async function listar(filtros = {}) {
  const condiciones = [];
  const params = [];

  if (filtros.estado) {
    if (!ESTADOS.includes(filtros.estado)) throw new AppError('estado inválido', 400);
    params.push(filtros.estado);
    condiciones.push(`c.estado = $${params.length}`);
  }
  if (filtros.cliente_id) {
    params.push(parseId(filtros.cliente_id, 'cliente_id'));
    condiciones.push(`c.cliente_id = $${params.length}`);
  }
  if (filtros.desde) {
    params.push(fechaValida(filtros.desde, 'desde').toISOString());
    condiciones.push(`c.fecha_hora >= $${params.length}`);
  }
  if (filtros.hasta) {
    params.push(fechaValida(filtros.hasta, 'hasta').toISOString());
    condiciones.push(`c.fecha_hora <= $${params.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(`${BASE_SELECT} ${where} ORDER BY c.fecha_hora ASC`, params);
  return rows;
}

async function obtener(id) {
  const { rows } = await db.query(`${BASE_SELECT} WHERE c.id = $1`, [parseId(id)]);
  if (!rows[0]) throw new AppError('Cita no encontrada', 404);
  return rows[0];
}

async function crear(datos = {}, usuarioId = null) {
  const clienteId = parseId(datos.cliente_id, 'cliente_id');
  const fecha = fechaValida(datos.fecha_hora, 'fecha_hora');
  const motivo = textoRequerido(datos.motivo, 'motivo');
  const notas = textoOpcional(datos.notas);

  if (await existeDuplicada(clienteId, fecha)) {
    throw new AppError('Ya existe una cita activa para este cliente en esa fecha y hora', 409);
  }

  const { rows } = await db.query(
    `INSERT INTO citas (cliente_id, fecha_hora, motivo, notas, creado_por)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [clienteId, fecha.toISOString(), motivo, notas, usuarioId]
  );
  return rows[0];
}

async function actualizar(id, datos = {}) {
  const actual = await obtener(id);

  if (!ESTADOS_EDITABLES.includes(actual.estado)) {
    throw new AppError(`No se puede editar una cita ${actual.estado}`, 409);
  }

  const clienteId =
    datos.cliente_id !== undefined ? parseId(datos.cliente_id, 'cliente_id') : actual.cliente_id;
  const fecha =
    datos.fecha_hora !== undefined ? fechaValida(datos.fecha_hora, 'fecha_hora') : fechaValida(actual.fecha_hora);
  const motivo = datos.motivo !== undefined ? textoRequerido(datos.motivo, 'motivo') : actual.motivo;
  const notas = datos.notas !== undefined ? textoOpcional(datos.notas) : actual.notas;

  const cambioAgenda = clienteId !== actual.cliente_id || fecha.getTime() !== new Date(actual.fecha_hora).getTime();
  if (cambioAgenda && (await existeDuplicada(clienteId, fecha, actual.id))) {
    throw new AppError('Ya existe una cita activa para este cliente en esa fecha y hora', 409);
  }

  const { rows } = await db.query(
    `UPDATE citas
     SET cliente_id = $1, fecha_hora = $2, motivo = $3, notas = $4, updated_at = now()
     WHERE id = $5 RETURNING *`,
    [clienteId, fecha.toISOString(), motivo, notas, actual.id]
  );
  return rows[0];
}

async function cambiarEstado(id, estadoNuevo) {
  if (!ESTADOS.includes(estadoNuevo)) {
    throw new AppError(`estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`, 400);
  }

  const actual = await obtener(id);
  if (!puedeTransicionar(actual.estado, estadoNuevo)) {
    throw new AppError(`No se puede pasar una cita de "${actual.estado}" a "${estadoNuevo}"`, 409);
  }

  const { rows } = await db.query(
    'UPDATE citas SET estado = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [estadoNuevo, actual.id]
  );
  return rows[0];
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  puedeTransicionar,
  ESTADOS,
  TRANSICIONES,
};
