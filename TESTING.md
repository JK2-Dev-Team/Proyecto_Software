# Pruebas automatizadas — Sistema del Laboratorio Dental Miguel Torres

Suite de pruebas organizada por los niveles de la pirámide del testing: unitarias e integración en el backend (Node.js + Express + PostgreSQL), y funcionales y E2E en un navegador real con Playwright.

| Nivel | Carpeta | Herramientas | Pruebas | Tiempo aprox. |
| --- | --- | --- | --- | --- |
| 1. Unitarias (con mocks) | `backend/tests/unit/` | Jest + `jest.fn()` / `jest.mock()` | 127 | 1,5 s |
| 2. Integración (API + base de datos real) | `backend/tests/integration/` | Jest + Supertest + PostgreSQL desechable (`embedded-postgres`) | 34 | 2–5 s |
| 3. Funcionales (requisitos, caja negra) | `frontend/e2e/funcionales.spec.js` | Playwright + Chromium | 5 | 5 s |
| 4. E2E (flujo completo) | `frontend/e2e/flujo-completo.spec.js` | Playwright + Chromium | 1 | 2 s |
| **Total** | | | **167** | |

**Cobertura total del backend: 95,4 % de líneas y 93,6 % de sentencias** (umbral obligatorio configurado: 60 %). Se mide sobre todo `backend/src/` excepto `server.js`, que solo arranca el servidor.

## 1. Instalar

Requisitos: Node.js 20 o superior. No hace falta instalar PostgreSQL ni Docker: las pruebas de integración descargan con `npm` una PostgreSQL propia, la levantan en el puerto 54329, la usan y la borran al terminar.

```bash
cd backend
npm install
```

## 2. Ejecutar

Desde la raíz del repositorio, con el atajo:

| Qué | Windows | Mac / Linux |
| --- | --- | --- |
| Todas las pruebas | `run-tests.bat` | `./run-tests.sh` |
| Solo unitarias | `run-tests.bat unit` | `./run-tests.sh unit` |
| Solo integración | `run-tests.bat integration` | `./run-tests.sh integration` |
| Cobertura (consola + HTML) | `run-tests.bat cov` | `./run-tests.sh cov` |
| Funcionales y E2E (navegador) | `run-tests.bat e2e` | `./run-tests.sh e2e` |

O directamente desde `backend/`: `npm test`, `npm run test:unit`, `npm run test:integration` y `npm run test:cov`. Desde `frontend/`: `npm run test:e2e` (sin ventana), `npm run test:e2e:ver` (abre el navegador para verlo trabajar) y `npm run test:e2e:reporte` (reporte HTML de Playwright).

La primera vez que se corren las pruebas E2E se descarga Chromium (`npx playwright install chromium`; el atajo lo hace solo).

El reporte visual de cobertura queda en `backend/coverage/index.html` (en Windows, `run-tests.bat cov` lo abre solo). Si la cobertura baja del 60 %, el comando termina en error.

GitHub Actions corre `npm run test:cov` en cada Pull Request y en cada cambio a `main` (`.github/workflows/ci.yml`).

## 3. Qué protege cada nivel

### Unitarias (`tests/unit/`)

Prueban la lógica sin red ni base de datos. La base de datos se reemplaza por **mocks** de Jest:

- **Stub:** `db.query = jest.fn().mockResolvedValue({ rows: [...] })` devuelve una respuesta fija.
- **Spy:** `expect(db.query).toHaveBeenCalledWith(...)` verifica qué SQL y qué parámetros se enviaron.

| Archivo | Qué protege |
| --- | --- |
| `patrones.test.js` | Strategy (consumo por unidad y fijo), máquina de estados de la orden y Observer de alertas, con valores límite |
| `ordenes.test.js` | Descuento automático de insumos, reversión ante stock insuficiente y descuento único aunque haya retrabajo (base simulada con transacciones) |
| `citas.service.test.js` | Validaciones de citas, duplicados y flujo de estados |
| `clientes.service.test.js` | Validación de clientes |
| `auth.service.test.js` | Inicio de sesión, contraseñas cifradas y tokens |
| `usuarios.test.js` | Gestión de usuarios: nunca devolver la contraseña, no desactivarse a sí mismo y no quedar sin administrador |
| `reportes.test.js` | Períodos, fechas en hora de Colombia y agregaciones de los reportes |
| `app.test.js` | Rutas y middlewares: 401 sin token, 403 por rol, 404 y errores sin filtrar datos internos |

### Integración (`tests/integration/`)

No simulan nada del proyecto: petición HTTP real → rutas → servicios → patrones → **PostgreSQL real**. Después de cada acción consultan la base para comprobar lo que quedó guardado. Se cubren los códigos 200, 201, 204, 400, 401, 403, 404 y 409.

| Archivo | Qué protege |
| --- | --- |
| `ordenesInventario.int.test.js` | El flujo central: crear una orden, avanzarla a modelado, verificar en la base el stock descontado, los movimientos, la alerta (en el mínimo exacto sí, un gramo por encima no), la reversión completa por stock insuficiente y el historial de estados |
| `apiGeneral.int.test.js` | Inicio de sesión con bcrypt y JWT reales, clientes, citas (duplicados y estados), usuarios (correo único, desactivación, restablecer contraseña) y reportes con la zona horaria de Bogotá |

**Una sola base de pruebas, en serie:** los dos archivos de integración comparten la misma base y la vacían antes de cada prueba. Por eso los comandos usan `--runInBand` (un archivo a la vez); si corrieran en paralelo, uno borraría los datos del otro.

**Seguridad:** las pruebas de integración se niegan a correr si la conexión no apunta a la base local de pruebas (`tests/support/baseDatos.js`). Nunca tocan Supabase ni el archivo `.env`.

### Funcionales y E2E (`frontend/e2e/`)

Playwright abre Chromium y usa la aplicación como el personal del laboratorio. Antes de empezar levanta tres cosas propias de la prueba: una PostgreSQL desechable con datos de demostración, la API real en el puerto 3100 y la interfaz React en el 5174 (`frontend/playwright.config.js` y `backend/tests/support/servidorE2E.mjs`). No toca Supabase ni los servidores de desarrollo.

| Prueba | Qué verifica |
| --- | --- |
| RF-01 Inicio de sesión | Con una contraseña incorrecta muestra el error y no deja entrar |
| RF-02 Seguridad | Sin sesión, una página interna redirige al inicio de sesión |
| RF-03 Clientes | Un cliente registrado aparece en el listado con su tipo |
| RF-04 Órdenes | El formulario no deja crear una orden sin elegir cliente |
| RF-05 Roles | La recepcionista no ve la gestión de usuarios; el administrador sí |
| E2E flujo completo | Iniciar sesión → registrar cliente → crear orden de Corona → pasar a modelado → el yeso baja de 450 a 400 g, aparece "Stock bajo" y el contador de alertas → los reportes muestran la orden y el consumo |

## 4. Prueba de fuego (detección de defectos)

Se rompió a propósito una regla del código, se corrió la suite y se revirtió el cambio. Las 11 reglas probadas pusieron la suite en rojo:

| Defecto introducido | Archivo | Pruebas en rojo |
| --- | --- | --- |
| Consumo por unidad multiplicado por (unidades + 1) | `patterns/consumoStrategies.js` | 5 |
| Consumo fijo multiplicado por las unidades | `patterns/consumoStrategies.js` | 5 |
| Alerta con `<` en lugar de `<=` | `patterns/stockSubject.js` | 2 |
| Permitir pasar de "recibido" a "terminado" | `patterns/estadosOrden.js` | 3 |
| Descontar insumos en "terminado" en vez de "modelado" | `patterns/estadosOrden.js` | 8 |
| Permitir stock negativo | `services/inventarioService.js` | 2 |
| Confirmar (COMMIT) en vez de revertir cuando falta stock | `services/ordenService.js` | 2 |
| Dejar iniciar sesión a usuarios desactivados | `services/auth.service.js` | 3 |
| Permitir citas duplicadas | `services/citas.service.js` | 3 |
| Permitir quedar sin administrador activo | `services/usuarioService.js` | 3 |
| Calcular los reportes en UTC en vez de hora de Colombia | `services/reporteService.js` | 2 |

El defecto "descontar insumos en terminado" también pone en rojo la prueba E2E: en el navegador el yeso sigue en 450 g después de pasar a modelado.

## 5. Uso de inteligencia artificial

La suite se construyó con un asistente de IA (Claude). El equipo definió las reglas de negocio y revisó cada aserción para que verifique lo que el negocio exige y no copie lo que el código hace hoy.

### Reglas de negocio entregadas al asistente

- Al entrar a "modelado" se descuentan los insumos de la receta **una sola vez por orden**: los de modo "por unidad" se multiplican por las unidades (corona: 2 g de cerámica por unidad) y los de modo "fijo" no (yeso: 50 g por orden).
- Si falta stock de cualquier insumo, **no se descuenta nada** y la orden no cambia de estado.
- La alerta se abre cuando el stock queda **en el mínimo o por debajo**, y se cierra cuando se recupera.
- Las órdenes no pueden saltar etapas; control de calidad puede devolver el trabajo a cocción.
- Los reportes cuentan los días en **hora de Colombia**.
- Nadie puede desactivarse a sí mismo y siempre debe quedar un administrador activo.
- Las pruebas de integración nunca deben correr contra la base de producción.

### Casos en que hubo que corregir a la IA

1. **Mock mal configurado.** En la prueba de crear usuarios, el dato simulado de la base devolvía el mismo cuerpo enviado, contraseña incluida. La prueba "la respuesta nunca incluye la contraseña" falló por culpa del mock, no del código. Se corrigió el mock para que devuelva solo las columnas que la consulta real pide.
2. **Herramienta inadecuada.** La primera propuesta para la integración fue una PostgreSQL simulada en memoria (`pg-mem`). Al probarla, no soportaba `ON CONFLICT … WHERE` (con el que se abren las alertas) ni `AT TIME ZONE` (el de los reportes): habría dado falsos resultados en las reglas más importantes. Se reemplazó por una PostgreSQL real y desechable (`embedded-postgres`).
3. **Hallazgo en el esquema.** Al crear la base de pruebas desde `schema.sql` se detectó que al archivo le faltaban columnas y tablas que el código sí usa (`unidades`, `insumos_descontados`, `modo_consumo` y `alertas_stock`). Se documentaron en `backend/src/db/migrations/001_ordenes_inventario.sql`.
4. **Pruebas que pasaban en un equipo y fallaban en otro.** En el entorno donde se escribieron, con 2 núcleos, Jest corría los archivos uno tras otro y todo pasaba. En el portátil del equipo (Windows, más núcleos) los corrió en paralelo contra la misma base: un archivo vaciaba las tablas mientras el otro las usaba y fallaron 15 pruebas con "duplicate key". Se reprodujo forzando 2 procesos y se corrigió ejecutando la integración en serie (`--runInBand`).
5. **Aserción débil en la prueba E2E.** La primera versión comprobaba que la fila del yeso "contuviera" 400 g. Al hacerle la prueba de fuego (romper el descuento) siguió en verde: la fila también muestra el mínimo, que es 400 g. Se corrigió para revisar solo la celda de stock actual; con el defecto, ahora falla mostrando 450 g.
6. **Prueba de fuego mal apuntada.** Al simular el defecto "COMMIT en vez de ROLLBACK", el cambio cayó primero en la función de crear órdenes y la suite siguió en verde. Al revisarlo se vio que el defecto relevante es el de `cambiarEstado`; aplicado ahí, la suite sí falla.
