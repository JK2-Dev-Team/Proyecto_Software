const bcrypt = require('bcryptjs');
const { AppError } = require('../utils/errors');
const { parseId, textoRequerido, emailValido } = require('../utils/validators');

const ROLES = ['admin', 'recepcionista'];
// Nunca se selecciona password_hash: la contraseña no sale de la base de datos por ninguna ruta.
const COLUMNAS = 'id, nombre, email, rol, activo, created_at';

function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError(400, 'La contraseña debe tener al menos 8 caracteres');
  }
  // bcrypt solo usa los primeros 72 bytes: una clave más larga daría una falsa sensación de seguridad.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(400, 'La contraseña no puede superar 72 caracteres');
  }
  return password;
}

function validarRol(rol) {
  if (!ROLES.includes(rol)) {
    throw new AppError(400, `rol inválido. Valores permitidos: ${ROLES.join(', ')}`);
  }
  return rol;
}

// `rondas` es el costo de bcrypt: 10 en producción; las pruebas usan un valor bajo para ir rápido.
function createUsuarioService({ db, rondas = 10 }) {
  async function listar() {
    const { rows } = await db.query(`SELECT ${COLUMNAS} FROM usuarios ORDER BY activo DESC, nombre`);
    return rows;
  }

  async function crear(datos = {}) {
    const nombre = textoRequerido(datos.nombre, 'nombre', 120);
    const email = emailValido(datos.email);
    const password = validarPassword(datos.password);
    const rol = validarRol(datos.rol);

    const hash = await bcrypt.hash(password, rondas);
    // Un correo repetido lo convierte el manejador de errores en un 409 (código 23505 de PostgreSQL).
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
      [nombre, email, hash, rol]
    );
    return rows[0];
  }

  async function haySuplente(id) {
    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS n FROM usuarios WHERE rol = 'admin' AND activo = TRUE AND id <> $1",
      [id]
    );
    return Number(rows[0].n) > 0;
  }

  // actorId = quien hace el cambio (viene del token). Permite cambiar nombre, rol y activo.
  async function actualizar(actorId, idParam, datos = {}) {
    const id = parseId(idParam);
    const cambios = {};

    if (datos.nombre !== undefined) cambios.nombre = textoRequerido(datos.nombre, 'nombre', 120);
    if (datos.rol !== undefined) cambios.rol = validarRol(datos.rol);
    if (datos.activo !== undefined) {
      if (typeof datos.activo !== 'boolean') throw new AppError(400, 'activo debe ser verdadero o falso');
      cambios.activo = datos.activo;
    }
    if (Object.keys(cambios).length === 0) {
      throw new AppError(400, 'Indica al menos un dato a cambiar: nombre, rol o activo');
    }

    const { rows: actuales } = await db.query(`SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [id]);
    const actual = actuales[0];
    if (!actual) throw new AppError(404, 'Usuario no encontrado');

    const nuevo = { ...actual, ...cambios };

    // Protección 1: nadie puede quitarse a sí mismo el acceso.
    if (id === Number(actorId)) {
      if (!nuevo.activo) throw new AppError(409, 'No puedes desactivar tu propia cuenta');
      if (nuevo.rol !== 'admin') throw new AppError(409, 'No puedes quitarte tu propio rol de administrador');
    }

    // Protección 2: el sistema nunca se queda sin un administrador activo.
    const dejaDeSerAdminActivo = actual.rol === 'admin' && actual.activo && (nuevo.rol !== 'admin' || !nuevo.activo);
    if (dejaDeSerAdminActivo && !(await haySuplente(id))) {
      throw new AppError(409, 'Debe quedar al menos un administrador activo');
    }

    const { rows } = await db.query(
      `UPDATE usuarios SET nombre = $1, rol = $2, activo = $3 WHERE id = $4 RETURNING ${COLUMNAS}`,
      [nuevo.nombre, nuevo.rol, nuevo.activo, id]
    );
    return rows[0];
  }

  async function restablecerPassword(idParam, password) {
    const id = parseId(idParam);
    const hash = await bcrypt.hash(validarPassword(password), rondas);
    const { rowCount } = await db.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, id]);
    if (rowCount === 0) throw new AppError(404, 'Usuario no encontrado');
  }

  return { listar, crear, actualizar, restablecerPassword };
}

module.exports = { createUsuarioService, ROLES };
