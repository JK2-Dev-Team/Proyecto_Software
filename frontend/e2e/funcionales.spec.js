// FUNCIONALES: cada prueba verifica un requisito del sistema desde el punto de vista del usuario
// (caja negra), sin mirar el código: solo lo que la persona ve y hace en la pantalla.
import { test, expect } from '@playwright/test';
import { ADMIN, RECEPCION, iniciarSesion } from './apoyo.js';

test('RF-01 Inicio de sesión: con una contraseña incorrecta muestra un error y no deja entrar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill('incorrecta1');
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('alert')).toContainText('no coinciden');
  await expect(page).toHaveURL(/\/login/);
});

test('RF-02 Seguridad: sin sesión, una página interna redirige al inicio de sesión', async ({ page }) => {
  await page.goto('/inventario');
  await expect(page).toHaveURL(/\/login/);
});

test('RF-03 Clientes: un cliente registrado aparece en el listado con su tipo', async ({ page }) => {
  await iniciarSesion(page, ADMIN);
  await page.getByRole('link', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await page.getByLabel('Nombre').fill('Ana Funcional');
  await page.getByLabel('Tipo de cliente').selectOption('paciente');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();

  const fila = page.getByRole('row', { name: /Ana Funcional/ });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('Paciente');
});

test('RF-04 Órdenes: el formulario no permite crear una orden sin elegir cliente', async ({ page }) => {
  await iniciarSesion(page, ADMIN);
  await page.getByRole('button', { name: 'Nueva orden' }).click();
  await page.getByLabel('Procedimiento').selectOption({ label: 'Corona' });
  await page.getByRole('button', { name: 'Crear orden' }).click();

  // La validación del formulario lo impide: el diálogo sigue abierto y el campo queda inválido
  await expect(page.getByRole('heading', { name: 'Nueva orden de trabajo' })).toBeVisible();
  expect(await page.getByLabel('Cliente').evaluate((el) => el.validity.valid)).toBe(false);
});

test('RF-05 Roles: la recepcionista no ve la gestión de usuarios; el administrador sí', async ({ page }) => {
  await iniciarSesion(page, RECEPCION);
  await expect(page.getByRole('link', { name: 'Reportes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);

  await page.getByRole('button', { name: /Salir|Cerrar sesión/ }).click();
  await iniciarSesion(page, ADMIN);
  await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible();
});
