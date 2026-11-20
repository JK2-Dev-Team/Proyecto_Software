// Servidor para las pruebas E2E y funcionales (Playwright).
// Levanta una PostgreSQL desechable, crea el esquema, siembra datos de demostración y arranca
// la API real en el puerto 3100. Nunca usa Supabase ni el archivo .env.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { limpiarCarpetaPg } from './pgHuerfana.mjs';

const require = createRequire(import.meta.url);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../..'); // carpeta backend/

const PUERTO_PG = 54330;
const PUERTO_API = 3100;
const dir = path.join(raiz, '.pg-e2e');
await limpiarCarpetaPg(dir);

const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'postgres', password: 'postgres', port: PUERTO_PG, persistent: false, onLog: () => {},
});

async function detener() {
  try { await pg.stop(); } catch { /* ya estaba detenida */ }
  process.exit(0);
}
process.on('SIGINT', detener);
process.on('SIGTERM', detener);

process.on('unhandledRejection', async (e) => {
  console.error(e);
  try { await pg.stop(); } catch { /* nada */ }
  process.exit(1);
});

await pg.initialise();
await pg.start();
await pg.createDatabase('labdental_e2e');

// Variables fijadas ANTES de cargar la app: dotenv no las reemplaza con las del .env.
process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PUERTO_PG}/labdental_e2e`;
process.env.DB_SSL = 'false';
process.env.JWT_SECRET = 'secreto-solo-para-e2e';
process.env.CORS_ORIGIN = 'http://127.0.0.1:5174';
process.env.PORT = String(PUERTO_API);

const db = require(path.join(raiz, 'src/db/connection.js'));
const bcrypt = require('bcryptjs');

const sql = ['src/db/schema.sql', 'src/db/migrations/001_ordenes_inventario.sql']
  .map((f) => fs.readFileSync(path.join(raiz, f), 'utf8'))
  .join('\n');
await db.query(sql);

// Datos de demostración (los mismos de la presentación en la feria)
const hash = await bcrypt.hash('Clave12345', 4);
await db.query(
  `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
     ('Admin E2E', 'admin@e2e.co', $1, 'admin'),
     ('Recepción E2E', 'recepcion@e2e.co', $1, 'recepcionista')`,
  [hash]
);
const ins = await db.query(
  `INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo) VALUES
     ('Cerámica', 'g', 100, 10), ('Yeso', 'g', 450, 400) RETURNING id, nombre`
);
const id = Object.fromEntries(ins.rows.map((r) => [r.nombre, r.id]));
await db.query(
  `INSERT INTO procedimiento_insumos (tipo_procedimiento_id, insumo_id, cantidad, modo_consumo)
   SELECT tp.id, $1::int, 2, 'por_unidad' FROM tipos_procedimiento tp WHERE tp.nombre = 'Corona'
   UNION ALL
   SELECT tp.id, $2::int, 50, 'fijo' FROM tipos_procedimiento tp WHERE tp.nombre = 'Corona'`,
  [id['Cerámica'], id['Yeso']]
);

const app = require(path.join(raiz, 'src/app.js'));
app.listen(PUERTO_API, '127.0.0.1', () => console.log(`API de pruebas E2E en http://127.0.0.1:${PUERTO_API}`));
