// Crea el primer usuario administrador. Uso: npm run seed:admin
// Lee ADMIN_NOMBRE, ADMIN_EMAIL y ADMIN_PASSWORD del archivo .env
require('dotenv').config();
const db = require('../src/db/connection');
const authService = require('../src/services/auth.service');

async function main() {
  const { ADMIN_NOMBRE, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD en el .env');
  }

  const usuario = await authService.registrar({
    nombre: ADMIN_NOMBRE || 'Administrador',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    rol: 'admin',
  });
  console.log(`Administrador creado: ${usuario.email}`);
}

main()
  .catch((err) => {
    console.error('No se pudo crear el administrador:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.getPool().end());
