// Detiene la PostgreSQL de pruebas y borra sus datos.
export default async function globalTeardown() {
  const pg = globalThis.__PG_PRUEBAS__;
  if (pg) await pg.stop();
}
