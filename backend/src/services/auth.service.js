const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { textoRequerido, emailValido } = require('../utils/validators');

const ROLES = ['admin', 'recepcionista'];

async function login({ email, password } = {}) {
  if (!email || !password) {
    throw new AppError('Email y contraseña son obligatorios', 400);
  }

  const { rows } = await db.query(
    'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = $1',
    [String(email).toLowerCase().trim()]
  );
  const usuario = rows[0];

  // Mensaje genérico: no revela si el correo existe o no
  const credencialesOk =
    usuario && usuario.activo && (await bcrypt.compare(password, usuario.password_hash));
  if (!credencialesOk) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  };
}

async function registrar({ nombre, email, password, rol } = {}) {
  const datos = {
    nombre: textoRequerido(nombre, 'nombre', 120),
    email: emailValido(email),
  };

  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
  }
  if (!ROLES.includes(rol)) {
    throw new AppError(`rol inválido. Valores permitidos: ${ROLES.join(', ')}`, 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, email, rol, activo, created_at`,
    [datos.nombre, datos.email, passwordHash, rol]
  );
  return rows[0];
}

async function obtenerPerfil(id) {
  const { rows } = await db.query(
    'SELECT id, nombre, email, rol FROM usuarios WHERE id = $1 AND activo = TRUE',
    [id]
  );
  if (!rows[0]) throw new AppError('Usuario no encontrado', 404);
  return rows[0];
}

module.exports = { login, registrar, obtenerPerfil, ROLES };
