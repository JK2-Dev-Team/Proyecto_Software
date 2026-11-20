// Pruebas E2E y funcionales con Playwright: un navegador real usa la aplicación completa
// (React + API Express + PostgreSQL de prueba), igual que lo haría el personal del laboratorio.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // comparten una sola base de datos de prueba: se ejecutan en orden
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // API real con PostgreSQL desechable y datos de demostración
      command: 'node ../backend/tests/support/servidorE2E.mjs',
      url: 'http://127.0.0.1:3100/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // Interfaz React apuntando a esa API
      command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_URL: 'http://127.0.0.1:3100/api' },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
