// UNITARIAS de los patrones de diseño (Strategy, Observer y máquina de estados).
// Cada prueba sigue el patrón AAA: Arrange (preparar), Act (ejecutar), Assert (verificar).
// La base de datos se reemplaza por un MOCK de Jest (jest.fn), que actúa como:
//   - Stub: devuelve una respuesta fija sin tocar PostgreSQL.
//   - Spy: registra con qué SQL y parámetros lo llamaron, para verificarlo después.
const { calcularConsumo } = require('../../src/patterns/consumoStrategies');
const { puedeTransitar, ESTADOS, ESTADO_DESCUENTO } = require('../../src/patterns/estadosOrden');
const { StockSubject, AlertaStockBajoObserver } = require('../../src/patterns/stockSubject');

describe('Strategy: cálculo del consumo de insumos', () => {
  test.each([
    // [modo, cantidad de la receta, unidades de la orden, consumo esperado según la regla del laboratorio]
    ['por_unidad', '2', 1, 2], // valor límite: la orden mínima (1 unidad)
    ['por_unidad', '2', 3, 6], // 2 g de cerámica por cada corona
    ['por_unidad', '0.5', 3, 1.5], // cantidades con decimales
    ['fijo', '50', 1, 50], // 50 g de yeso por orden...
    ['fijo', '50', 10, 50], // ...sin importar cuántas unidades tenga
  ])('%s: receta %s × %i unidades = %d', (modo, cantidad, unidades, esperado) => {
    // Arrange
    const receta = { cantidad, modo_consumo: modo };
    // Act
    const consumo = calcularConsumo(receta, unidades);
    // Assert
    expect(consumo).toBe(esperado);
  });

  test('sin modo definido usa "por unidad" (valor por defecto de la base de datos)', () => {
    expect(calcularConsumo({ cantidad: '2' }, 4)).toBe(8);
  });

  test('un modo desconocido lanza un error en vez de calcular mal', () => {
    expect(() => calcularConsumo({ cantidad: 1, modo_consumo: 'por_kilo' }, 1)).toThrow(/Modo de consumo desconocido/);
  });
});

describe('Máquina de estados de la orden', () => {
  test('el camino normal recorre las 6 etapas en orden', () => {
    for (let i = 0; i < ESTADOS.length - 1; i++) {
      expect(puedeTransitar(ESTADOS[i], ESTADOS[i + 1])).toBe(true);
    }
  });

  test.each([
    ['recibido', 'terminado'], // saltar etapas
    ['en_modelado', 'recibido'], // retroceder
    ['entregado', 'recibido'], // reabrir una entregada
    ['recibido', 'recibido'], // quedarse en el mismo estado
    ['inventado', 'en_modelado'], // estado inexistente
  ])('no permite pasar de "%s" a "%s"', (desde, hacia) => {
    expect(puedeTransitar(desde, hacia)).toBe(false);
  });

  test('control de calidad puede devolver el trabajo a cocción (retrabajo)', () => {
    expect(puedeTransitar('control_calidad', 'en_coccion_acabado')).toBe(true);
  });

  test('los insumos se descuentan al empezar el modelado', () => {
    expect(ESTADO_DESCUENTO).toBe('en_modelado');
  });
});

describe('Observer: alerta de stock bajo (base de datos simulada con jest.fn)', () => {
  test('con el stock EXACTAMENTE en el mínimo abre la alerta (valor límite de "stock <= mínimo")', async () => {
    // Arrange: un mock de la base de datos (Stub: responde vacío; Spy: registra las llamadas)
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const observer = new AlertaStockBajoObserver(db);

    // Act
    await observer.update({ insumo_id: 7, stock_actual: '400.00', stock_minimo: '400.00' });

    // Assert: el Spy confirma que se intentó ABRIR la alerta con los datos correctos
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO alertas_stock/);
    expect(params).toEqual([7, '400.00', '400.00']);
  });

  test('con el stock UNA unidad por encima del mínimo cierra la alerta en vez de abrirla', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const observer = new AlertaStockBajoObserver(db);

    await observer.update({ insumo_id: 7, stock_actual: 401, stock_minimo: 400 });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/UPDATE alertas_stock SET abierta = FALSE/);
    expect(db.query.mock.calls[0][1]).toEqual([7]);
  });

  test('compara como números, no como texto ("90" no es mayor que "400")', async () => {
    // PostgreSQL devuelve NUMERIC como texto: comparado como texto, "90" > "400" sería verdadero.
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await new AlertaStockBajoObserver(db).update({ insumo_id: 1, stock_actual: '90', stock_minimo: '400' });
    expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO alertas_stock/);
  });

  test('el sujeto avisa a todos sus observadores, y uno que falla no impide avisar a los demás', async () => {
    // Arrange
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const subject = new StockSubject();
    const roto = { update: jest.fn().mockRejectedValue(new Error('se cayó')) };
    const sano = { update: jest.fn().mockResolvedValue() };
    subject.subscribe(roto);
    subject.subscribe(sano);
    const evento = { insumo_id: 1, stock_actual: 5, stock_minimo: 10 };

    // Act
    await subject.notify(evento);

    // Assert
    expect(roto.update).toHaveBeenCalledWith(evento);
    expect(sano.update).toHaveBeenCalledWith(evento);
    console.error.mockRestore();
  });

  test('un observador que se da de baja ya no recibe avisos', async () => {
    const subject = new StockSubject();
    const obs = { update: jest.fn() };
    const darDeBaja = subject.subscribe(obs);

    darDeBaja();
    await subject.notify({ insumo_id: 1 });

    expect(obs.update).not.toHaveBeenCalled();
  });
});
