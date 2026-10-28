const db = require('../db/connection');
const AppError = require('../utils/AppError');
const { parseId, textoRequerido, textoOpcional } = require('../utils/validators');

const TIPOS = ['odontologo', 'paciente'];

function validarCliente(datos = {}) {
  const nombre = textoRequerido(datos.nombre, 'nombre', 150);
  if (!TIPOS.includes(datos.tipo)) {
    throw new AppError(`tipo inválido. Valores permitidos: ${TIPOS.join(', ')}`, 400);
  }
  return {
    nombre,
    tipo: datos.tipo,
    telefono: textoOpcional(datos.telefono, 30),
    email: textoOpcional(datos.email, 150),
  };
}

async function listar({ tipo } = {}) {
  if (tipo) {
    if (!TIPOS.includes(tipo)) throw new AppError('tipo inválido', 400);
    const { rows } = await db.query('SELECT * FROM clientes WHERE tipo = $1 ORDER BY nombre', [tipo]);
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM clientes ORDER BY nombre');
  return rows;
}

async function obtener(id) {
  const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [parseId(id)]);
  if (!rows[0]) throw new AppError('Cliente no encontrado', 404);
  return rows[0];
}

async function crear(datos) {
  const c = validarCliente(datos);
  const { rows } = await db.query(
    'INSERT INTO clientes (nombre, tipo, telefono, email) VALUES ($1, $2, $3, $4) RETURNING *',
    [c.nombre, c.tipo, c.telefono, c.email]
  );
  return rows[0];
}

async function actualizar(id, datos) {
  const clienteId = parseId(id);
  const c = validarCliente(datos);
  const { rows } = await db.query(
    `UPDATE clientes SET nombre = $1, tipo = $2, telefono = $3, email = $4
     WHERE id = $5 RETURNING *`,
    [c.nombre, c.tipo, c.telefono, c.email, clienteId]
  );
  if (!rows[0]) throw new AppError('Cliente no encontrado', 404);
  return rows[0];
}

module.exports = { listar, obtener, crear, actualizar, validarCliente, TIPOS };
