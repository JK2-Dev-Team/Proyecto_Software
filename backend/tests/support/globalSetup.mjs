// Levanta una PostgreSQL REAL y desechable solo para las pruebas de integración.
// No usa Supabase ni el .env: los binarios vienen en el paquete npm `embedded-postgres`,
// así que funciona igual en Windows, en Mac y en GitHub Actions sin instalar nada más.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUERTO = Number(process.env.TEST_PG_PORT || 54329);

export default async function globalSetup() {
  // Carpeta dentro de backend/ (ignorada por git): evita rutas con espacios o tildes del usuario de Windows.
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.pg-test');
  fs.rmSync(dir, { recursive: true, force: true }); // por si una ejecución anterior se interrumpió
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port: PUERTO,
    persistent: false, // al detenerse borra la carpeta de datos
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('labdental_test');

  // Las variables quedan disponibles para los procesos de prueba. Se fijan ANTES de cargar la app,
  // así dotenv no las reemplaza con las del .env (dotenv nunca sobrescribe una variable ya definida).
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PUERTO}/labdental_test`;
  process.env.DB_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-solo-para-pruebas';

  globalThis.__PG_PRUEBAS__ = pg;
}
