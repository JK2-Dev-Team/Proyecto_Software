// Si una ejecución anterior se cortó de golpe (por ejemplo, Ctrl+C o Windows cerró el proceso),
// puede quedar una PostgreSQL de prueba viva ocupando la carpeta y el puerto. Esto la detiene
// antes de borrar la carpeta y arrancar una nueva.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export async function limpiarCarpetaPg(dir) {
  if (fs.existsSync(path.join(dir, 'postmaster.pid'))) {
    const so = process.platform === 'win32' ? 'windows' : process.platform;
    try {
      const { pg_ctl } = await import(`@embedded-postgres/${so}-${process.arch}`);
      spawnSync(pg_ctl, ['stop', '-D', dir, '-m', 'immediate', '-w'], { stdio: 'ignore' });
    } catch {
      /* si no se puede detener, el borrado de abajo lo informará */
    }
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
