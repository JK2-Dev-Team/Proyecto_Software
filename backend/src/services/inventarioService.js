const { AppError } = require('../utils/errors');

const SIGNOS = { entrada: 1, salida: -1 };

function createInventarioService({ db, subject }) {
  // Ejecuta el movimiento con el `executor` dado (pool o cliente de transacción).
  // Devuelve el evento; quien llama decide cuándo notificar (después del COMMIT).
  async function aplicarMovimiento(executor, { insumo_id, tipo, cantidad, motivo, orden_id, usuario_id }) {
    const cant = Number(cantidad);
    if (!['entrada', 'salida'].includes(tipo)) throw new AppError(400, 'Tipo de movimiento inválido (entrada o salida)');
    if (!Number.isFinite(cant) || cant <= 0) throw new AppError(400, 'La cantidad debe ser un número mayor que cero');

    const delta = SIGNOS[tipo] * cant; // solo afecta al stock; en movimientos se guarda siempre positiva

    const upd = await executor.query(
      `UPDATE insumos SET stock_actual = stock_actual + $2
       WHERE id = $1 AND activo AND stock_actual + $2 >= 0
       RETURNING id, nombre, stock_actual, stock_minimo`,
      [insumo_id, delta]
    );
    if (upd.rows.length === 0) {
      const ex = await executor.query('SELECT nombre, stock_actual FROM insumos WHERE id = $1 AND activo', [insumo_id]);
      if (ex.rows.length === 0) throw new AppError(404, 'Insumo no encontrado');
      throw new AppError(409, `Stock insuficiente de "${ex.rows[0].nombre}" (disponible: ${ex.rows[0].stock_actual})`);
    }

    await executor.query(
      `INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, motivo, orden_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [insumo_id, tipo, cant, motivo || null, orden_id || null, usuario_id || null]
    );

    const i = upd.rows[0];
    return { insumo_id: i.id, nombre: i.nombre, stock_actual: i.stock_actual, stock_minimo: i.stock_minimo, tipo };
  }

  async function registrarMovimiento(datos) {
    const evento = await aplicarMovimiento(db, datos);
    await subject.notify(evento);
    return evento;
  }

  async function crearInsumo({ nombre, unidad, stock_actual = 0, stock_minimo = 0 }) {
    if (!nombre || !unidad) throw new AppError(400, 'nombre y unidad son obligatorios');
    if (Number(stock_actual) < 0 || Number(stock_minimo) < 0) throw new AppError(400, 'Los stocks no pueden ser negativos');
    try {
      const r = await db.query(
        `INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [nombre.trim(), unidad, stock_actual, stock_minimo]
      );
      const i = r.rows[0];
      await subject.notify({ insumo_id: i.id, stock_actual: i.stock_actual, stock_minimo: i.stock_minimo, tipo: 'alta' });
      return i;
    } catch (err) {
      if (err.code === '23505') throw new AppError(409, 'Ya existe un insumo con ese nombre');
      throw err;
    }
  }

  async function listarInsumos({ bajoStock } = {}) {
    const where = bajoStock ? 'AND stock_actual <= stock_minimo' : '';
    const r = await db.query(`SELECT * FROM insumos WHERE activo ${where} ORDER BY nombre`);
    return r.rows;
  }

  async function listarAlertas() {
    const r = await db.query(
      `SELECT a.*, i.nombre, i.unidad FROM alertas_stock a
       JOIN insumos i ON i.id = a.insumo_id WHERE a.abierta ORDER BY a.creada_en DESC`
    );
    return r.rows;
  }

  return { aplicarMovimiento, registrarMovimiento, crearInsumo, listarInsumos, listarAlertas };
}

module.exports = { createInventarioService };
