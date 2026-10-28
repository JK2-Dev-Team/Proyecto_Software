// Patrón Observer: el inventario notifica cada cambio de stock a sus observadores.
class StockSubject {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((o) => o !== observer);
    };
  }

  // Un observador que falla no debe romper la operación de inventario.
  async notify(evento) {
    await Promise.all(
      this.observers.map(async (o) => {
        try {
          await o.update(evento);
        } catch (err) {
          console.error('Observer de stock falló:', err.message);
        }
      })
    );
  }
}

// Observador: abre/cierra alertas de stock bajo.
class AlertaStockBajoObserver {
  constructor(db) {
    this.db = db;
  }

  async update({ insumo_id, stock_actual, stock_minimo }) {
    if (Number(stock_actual) <= Number(stock_minimo)) {
      await this.db.query(
        `INSERT INTO alertas_stock (insumo_id, stock_actual, stock_minimo)
         VALUES ($1, $2, $3)
         ON CONFLICT (insumo_id) WHERE abierta DO UPDATE SET stock_actual = EXCLUDED.stock_actual`,
        [insumo_id, stock_actual, stock_minimo]
      );
    } else {
      await this.db.query(
        'UPDATE alertas_stock SET abierta = FALSE, cerrada_en = now() WHERE insumo_id = $1 AND abierta',
        [insumo_id]
      );
    }
  }
}

module.exports = { StockSubject, AlertaStockBajoObserver };
