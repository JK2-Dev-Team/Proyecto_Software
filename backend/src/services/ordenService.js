const { AppError } = require('../utils/errors');
const { ESTADOS, ESTADO_DESCUENTO, puedeTransitar } = require('../patterns/estadosOrden');
const { calcularConsumo } = require('../patterns/consumoStrategies');

function createOrdenService({ db, inventario, subject }) {
  async function crear(datos, usuario) {
    const { cliente_id, tipo_procedimiento_id, cita_id, unidades = 1, descripcion, fecha_entrega_estimada } = datos;
    if (!cliente_id || !tipo_procedimiento_id) throw new AppError(400, 'cliente_id y tipo_procedimiento_id son obligatorios');
    if (!Number.isInteger(unidades) || unidades < 1) throw new AppError(400, 'unidades debe ser un entero >= 1');

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO ordenes_trabajo
           (cliente_id, cita_id, tipo_procedimiento_id, unidades, descripcion, fecha_entrega_estimada, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [cliente_id, cita_id || null, tipo_procedimiento_id, unidades, descripcion || null, fecha_entrega_estimada || null, usuario?.id || null]
      );
      const orden = r.rows[0];
      await client.query(
        'INSERT INTO orden_historial_estados (orden_id, estado_anterior, estado_nuevo, usuario_id) VALUES ($1, NULL, $2, $3)',
        [orden.id, orden.estado, usuario?.id || null]
      );
      await client.query('COMMIT');
      return orden;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23503') throw new AppError(400, 'Cliente, cita o procedimiento inexistente');
      throw err;
    } finally {
      client.release();
    }
  }

  async function cambiarEstado(id, nuevoEstado, usuario) {
    if (!ESTADOS.includes(nuevoEstado)) throw new AppError(400, `Estado inválido. Opciones: ${ESTADOS.join(', ')}`);

    const client = await db.getPool().connect();
    const eventos = [];
    try {
      await client.query('BEGIN');

      const found = await client.query('SELECT * FROM ordenes_trabajo WHERE id = $1 FOR UPDATE', [id]);
      if (found.rows.length === 0) throw new AppError(404, 'Orden no encontrada');
      const orden = found.rows[0];

      if (!puedeTransitar(orden.estado, nuevoEstado)) {
        throw new AppError(409, `No se puede pasar de "${orden.estado}" a "${nuevoEstado}"`);
      }

      // Descuento automático de insumos (una sola vez por orden).
      if (nuevoEstado === ESTADO_DESCUENTO && !orden.insumos_descontados) {
        const receta = await client.query(
          'SELECT insumo_id, cantidad, modo_consumo FROM procedimiento_insumos WHERE tipo_procedimiento_id = $1',
          [orden.tipo_procedimiento_id]
        );
        for (const linea of receta.rows) {
          eventos.push(
            await inventario.aplicarMovimiento(client, {
              insumo_id: linea.insumo_id,
              tipo: 'salida',
              cantidad: calcularConsumo(linea, orden.unidades),
              motivo: `Consumo orden #${orden.id}`,
              orden_id: orden.id,
              usuario_id: usuario?.id,
            })
          );
        }
        await client.query('UPDATE ordenes_trabajo SET insumos_descontados = TRUE WHERE id = $1', [orden.id]);
      }

      const upd = await client.query(
        'UPDATE ordenes_trabajo SET estado = $2, updated_at = now() WHERE id = $1 RETURNING *',
        [orden.id, nuevoEstado]
      );
      await client.query(
        'INSERT INTO orden_historial_estados (orden_id, estado_anterior, estado_nuevo, usuario_id) VALUES ($1,$2,$3,$4)',
        [orden.id, orden.estado, nuevoEstado, usuario?.id || null]
      );

      await client.query('COMMIT');

      // Se notifica solo después del COMMIT para no alertar por cambios revertidos.
      for (const e of eventos) await subject.notify(e);
      return upd.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function obtener(id) {
    const o = await db.query('SELECT * FROM ordenes_trabajo WHERE id = $1', [id]);
    if (o.rows.length === 0) throw new AppError(404, 'Orden no encontrada');
    const h = await db.query('SELECT * FROM orden_historial_estados WHERE orden_id = $1 ORDER BY created_at', [id]);
    return { ...o.rows[0], historial: h.rows };
  }

  async function listar({ estado, cliente_id } = {}) {
    const cond = [];
    const params = [];
    if (estado) { params.push(estado); cond.push(`estado = $${params.length}`); }
    if (cliente_id) { params.push(cliente_id); cond.push(`cliente_id = $${params.length}`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await db.query(`SELECT * FROM ordenes_trabajo ${where} ORDER BY created_at DESC`, params);
    return r.rows;
  }

  return { crear, cambiarEstado, obtener, listar };
}

module.exports = { createOrdenService };
