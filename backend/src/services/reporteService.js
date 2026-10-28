const { AppError } = require('../utils/errors');
const { ESTADOS: ESTADOS_ORDEN } = require('../patterns/estadosOrden');

// Los reportes agrupan por día/semana en la hora de Colombia, no en UTC: una orden creada a las
// 9 p. m. del 30 de octubre en Bogotá ya es "31 de octubre" en UTC y se contaría en el día equivocado.
const ZONA = 'America/Bogota';
const ESTADOS_CITA = ['pendiente', 'confirmada', 'completada', 'cancelada'];
const DIAS_POR_DEFECTO = 30;
const MAX_DIAS = 366;
const MS_DIA = 86400000;

// ---------- Utilidades de fechas (texto "AAAA-MM-DD", siempre calculadas en UTC para evitar corrimientos) ----------
const aFecha = (texto) => new Date(`${texto}T00:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (texto, n) => aTexto(new Date(aFecha(texto).getTime() + n * MS_DIA));
// Lunes de la semana de una fecha (las semanas van de lunes a domingo, igual que date_trunc('week') en PostgreSQL)
const lunesDe = (texto) => sumarDias(texto, -((aFecha(texto).getUTCDay() + 6) % 7));

function validarFecha(valor, campo) {
  const formatoOk = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const fecha = formatoOk ? aFecha(valor) : null;
  // La segunda comprobación atrapa fechas imposibles como 2026-02-30, que JavaScript "corregiría" a marzo
  if (!fecha || Number.isNaN(fecha.getTime()) || aTexto(fecha) !== valor) {
    throw new AppError(400, `${campo} debe ser una fecha válida con formato AAAA-MM-DD`);
  }
  return valor;
}

// Si no se envía período: los últimos 30 días hasta hoy.
function resolverPeriodo({ desde, hasta } = {}, hoy) {
  const fin = hasta ? validarFecha(hasta, 'hasta') : hoy;
  const inicio = desde ? validarFecha(desde, 'desde') : sumarDias(fin, -(DIAS_POR_DEFECTO - 1));
  if (inicio > fin) throw new AppError(400, '"desde" no puede ser posterior a "hasta"');
  const dias = (aFecha(fin) - aFecha(inicio)) / MS_DIA + 1;
  if (dias > MAX_DIAS) throw new AppError(400, `El período no puede superar ${MAX_DIAS} días`);
  return { desde: inicio, hasta: fin };
}

// ---------- Consultas ----------
// Los parámetros son: $1 = desde, $2 = hasta (inclusive), $3 = zona horaria.
const FILTRO_FECHA = (columna) => `(${columna} AT TIME ZONE $3::text)::date BETWEEN $1::date AND $2::date`;

const SQL_ORDENES = `
  SELECT o.cliente_id, c.nombre AS cliente, o.estado, COUNT(*)::int AS total
  FROM ordenes_trabajo o
  JOIN clientes c ON c.id = o.cliente_id
  WHERE ${FILTRO_FECHA('o.created_at')}
  GROUP BY o.cliente_id, c.nombre, o.estado`;

// Consumo = salidas de inventario. Las que traen orden_id son el descuento automático de las órdenes;
// las demás son salidas manuales (merma, ajuste, uso fuera de una orden).
const SQL_CONSUMO = `
  SELECT i.id AS insumo_id, i.nombre AS insumo, i.unidad,
         COALESCE(SUM(m.cantidad), 0) AS total_consumido,
         COALESCE(SUM(m.cantidad) FILTER (WHERE m.orden_id IS NOT NULL), 0) AS consumo_ordenes,
         COALESCE(SUM(m.cantidad) FILTER (WHERE m.orden_id IS NULL), 0) AS salidas_manuales,
         COUNT(DISTINCT m.orden_id)::int AS ordenes
  FROM movimientos_inventario m
  JOIN insumos i ON i.id = m.insumo_id
  WHERE m.tipo = 'salida' AND ${FILTRO_FECHA('m.created_at')}
  GROUP BY i.id, i.nombre, i.unidad`;

const SQL_CITAS = `
  SELECT to_char(date_trunc('week', c.fecha_hora AT TIME ZONE $3::text), 'YYYY-MM-DD') AS semana_inicio,
         c.estado, COUNT(*)::int AS total
  FROM citas c
  WHERE ${FILTRO_FECHA('c.fecha_hora')}
  GROUP BY 1, 2`;

function createReporteService({ db, ahora = () => new Date() }) {
  // "en-CA" devuelve la fecha como AAAA-MM-DD
  const hoy = () => ahora().toLocaleDateString('en-CA', { timeZone: ZONA });

  // Órdenes creadas en el período, agrupadas por estado actual y por cliente.
  async function ordenes(query) {
    const periodo = resolverPeriodo(query, hoy());
    const { rows } = await db.query(SQL_ORDENES, [periodo.desde, periodo.hasta, ZONA]);

    const porEstado = Object.fromEntries(ESTADOS_ORDEN.map((e) => [e, 0]));
    const clientes = new Map();

    for (const fila of rows) {
      const n = Number(fila.total);
      porEstado[fila.estado] = (porEstado[fila.estado] || 0) + n;

      if (!clientes.has(fila.cliente_id)) {
        clientes.set(fila.cliente_id, {
          cliente_id: fila.cliente_id,
          cliente: fila.cliente,
          total: 0,
          estados: Object.fromEntries(ESTADOS_ORDEN.map((e) => [e, 0])),
        });
      }
      const c = clientes.get(fila.cliente_id);
      c.total += n;
      c.estados[fila.estado] = (c.estados[fila.estado] || 0) + n;
    }

    const por_cliente = [...clientes.values()].sort(
      (a, b) => b.total - a.total || a.cliente.localeCompare(b.cliente, 'es')
    );

    return {
      periodo,
      total: por_cliente.reduce((suma, c) => suma + c.total, 0),
      por_estado: Object.entries(porEstado).map(([estado, total]) => ({ estado, total })),
      por_cliente,
    };
  }

  // Insumos consumidos (salidas) en el período, de mayor a menor.
  async function consumoInsumos(query) {
    const periodo = resolverPeriodo(query, hoy());
    const { rows } = await db.query(SQL_CONSUMO, [periodo.desde, periodo.hasta, ZONA]);

    const insumos = rows
      .map((f) => ({
        insumo_id: f.insumo_id,
        insumo: f.insumo,
        unidad: f.unidad,
        total_consumido: Number(f.total_consumido),
        consumo_ordenes: Number(f.consumo_ordenes),
        salidas_manuales: Number(f.salidas_manuales),
        ordenes: Number(f.ordenes),
      }))
      .sort((a, b) => b.total_consumido - a.total_consumido || a.insumo.localeCompare(b.insumo, 'es'));

    return { periodo, insumos };
  }

  // Citas por semana (lunes a domingo) y estado. Las semanas sin citas aparecen con ceros.
  async function citasSemanales(query) {
    const periodo = resolverPeriodo(query, hoy());
    const { rows } = await db.query(SQL_CITAS, [periodo.desde, periodo.hasta, ZONA]);

    const semanas = new Map();
    for (let lunes = lunesDe(periodo.desde); lunes <= periodo.hasta; lunes = sumarDias(lunes, 7)) {
      semanas.set(lunes, {
        semana_inicio: lunes,
        semana_fin: sumarDias(lunes, 6),
        total: 0,
        ...Object.fromEntries(ESTADOS_CITA.map((e) => [e, 0])),
      });
    }

    for (const fila of rows) {
      const semana = semanas.get(fila.semana_inicio);
      if (!semana) continue; // no debería ocurrir: las filas ya vienen filtradas por el período
      const n = Number(fila.total);
      semana.total += n;
      semana[fila.estado] = (semana[fila.estado] || 0) + n;
    }

    const lista = [...semanas.values()];
    return { periodo, total: lista.reduce((suma, s) => suma + s.total, 0), semanas: lista };
  }

  return { ordenes, consumoInsumos, citasSemanales };
}

module.exports = { createReporteService, resolverPeriodo, lunesDe };
