// E2E (de punta a punta): el flujo principal del laboratorio en un navegador real,
// atravesando todas las capas: interfaz React → API Express → patrones → PostgreSQL.
import { test, expect } from '@playwright/test';
import { ADMIN, iniciarSesion } from './apoyo.js';

test('una orden de Corona descuenta insumos al pasar a modelado, dispara la alerta y aparece en los reportes', async ({ page }) => {
  // 1. Iniciar sesión como administrador
  await iniciarSesion(page, ADMIN);

  // 2. Registrar un cliente
  await page.getByRole('link', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await page.getByLabel('Nombre').fill('Dra. Flujo E2E');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('cell', { name: 'Dra. Flujo E2E' })).toBeVisible();

  // 3. Antes: el yeso está en 450 g con mínimo 400 g, sin alerta
  await page.getByRole('link', { name: /Inventario/ }).click();
  const yeso = page.getByRole('row', { name: /Yeso/ });
  // Columna 2 = "Stock actual" (la 3 es el mínimo, que también dice "400 g")
  const stockYeso = yeso.getByRole('cell').nth(1);
  await expect(stockYeso).toHaveText('450 g');
  await expect(yeso).toContainText('Suficiente');

  // 4. Crear una orden de Corona con 1 unidad
  await page.getByRole('link', { name: 'Órdenes' }).click();
  await page.getByRole('button', { name: 'Nueva orden' }).click();
  await page.getByLabel('Cliente').selectOption({ label: 'Dra. Flujo E2E' });
  await page.getByLabel('Procedimiento').selectOption({ label: 'Corona' });
  await page.getByLabel('Unidades').fill('1');
  await page.getByRole('button', { name: 'Crear orden' }).click();

  const orden = page.locator('li.orden', { hasText: 'Dra. Flujo E2E' });
  await expect(page.locator('section.etapa', { hasText: 'Recibido' }).locator('li.orden', { hasText: 'Dra. Flujo E2E' })).toBeVisible();

  // 5. Pasar a modelado: aquí el sistema descuenta los insumos de la receta
  await orden.getByRole('button', { name: /Pasar a .*modelado/i }).click();
  await expect(page.locator('section.etapa', { hasText: 'modelado' }).locator('li.orden', { hasText: 'Dra. Flujo E2E' })).toBeVisible();

  // 6. Después: yeso 450 - 50 = 400 g (igual al mínimo) → stock bajo y alerta en el menú
  await page.getByRole('link', { name: /Inventario/ }).click();
  await expect(stockYeso).toHaveText('400 g');
  await expect(yeso).toContainText('Stock bajo');
  await expect(page.getByRole('row', { name: /Cerámica/ }).getByRole('cell').nth(1)).toHaveText('98 g'); // 100 - 2 × 1 unidad
  await expect(page.locator('.pastilla')).toHaveText('1'); // contador de alertas en el menú

  // 7. Los reportes reflejan la orden y el consumo
  await page.getByRole('link', { name: 'Reportes' }).click();
  await expect(page.locator('.dato', { hasText: 'Órdenes creadas' })).toContainText('1');
  await expect(page.getByRole('row', { name: /Yeso/ })).toContainText('50 g');
});
