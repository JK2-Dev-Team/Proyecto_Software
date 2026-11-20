// Utilidades para las pruebas de integración: crean el esquema real, limpian las tablas
// entre pruebas y generan datos y tokens de prueba.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Seguro anti-accidentes: si por error la URL no apunta a la base local de pruebas,
// las pruebas se detienen antes de tocar nada (por ejemplo, nunca contra Supabase).
const url = process.env.DATABASE_URL || '';
if (!/^postgres:\/\/postgres:postgres@127\.0\.0\.1:\d+\/labdental_test$/.test(url)) {
  throw new Error('Las pruebas de integración solo corren contra la base local de pruebas. Usa: npm run test:integration');
}

const db = require('../../src/db/connection'); // el mismo Singleton que usa la app

const SQL_ESQUEMA = ['../../src/db/schema.sql', '../../src/db/migrations/001_ordenes_inventario.sql']
  .map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8'))
  .join('\n');

const TABLAS = [
  'alertas_stock', 'movimientos_inventario', 'orden_historial_estados', 'ordenes_trabajo',
  'procedimiento_insumos', 'insumos', 'citas', 'clientes', 'usuarios',
];

async function prepararEsquema() {
  // Un candado evita que dos archivos de prueba creen las tablas al mismo tiempo.
  const client = await db.getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock(4242)');
    await client.query(SQL_ESQUEMA);
  } finally {
    await client.query('SELECT pg_advisory_unlock(4242)');
    client.release();
  }
}

// Deja la base vacía (conserva los tipos de procedimiento que trae schema.sql).
async function limpiar() {
  await db.query(`TRUNCATE ${TABLAS.join(', ')} RESTART IDENTITY CASCADE`);
}

async function cerrar() {
  await db.getPool().end();
}

async function crearUsuario({ nombre = 'Admin Prueba', email = 'admin@prueba.co', password = 'Clave12345', rol = 'admin', activo = true } = {}) {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await db.query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, rol',
    [nombre, email, hash, rol, activo]
  );
  return rows[0];
}

const tokenDe = (usuario) =>
  jwt.sign({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }, process.env.JWT_SECRET, { expiresIn: '1h' });

async function idProcedimiento(nombre) {
  const { rows } = await db.query('SELECT id FROM tipos_procedimiento WHERE nombre = $1', [nombre]);
  return rows[0].id;
}

module.exports = { db, prepararEsquema, limpiar, cerrar, crearUsuario, tokenDe, idProcedimiento };
