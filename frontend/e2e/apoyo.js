// Pasos que se repiten en varias pruebas.
import { expect } from '@playwright/test';

export const ADMIN = { email: 'admin@e2e.co', password: 'Clave12345' };
export const RECEPCION = { email: 'recepcion@e2e.co', password: 'Clave12345' };

export async function iniciarSesion(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Órdenes de trabajo' })).toBeVisible();
}
