export const ESTADOS = [
  { id: 'recibido', etiqueta: 'Recibido' },
  { id: 'en_modelado', etiqueta: 'Modelado' },
  { id: 'en_coccion_acabado', etiqueta: 'Cocción/acabado' },
  { id: 'control_calidad', etiqueta: 'Control de calidad' },
  { id: 'terminado', etiqueta: 'Terminado' },
  { id: 'entregado', etiqueta: 'Entregado' },
];

// Debe coincidir con backend/src/patterns/estadosOrden.js
export const TRANSICIONES = {
  recibido: ['en_modelado'],
  en_modelado: ['en_coccion_acabado'],
  en_coccion_acabado: ['control_calidad'],
  control_calidad: ['terminado', 'en_coccion_acabado'],
  terminado: ['entregado'],
  entregado: [],
};

export const etiquetaEstado = (id) => ESTADOS.find((e) => e.id === id)?.etiqueta ?? id;

export const ESTADOS_CITA = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const TRANSICIONES_CITA = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['completada', 'cancelada'],
  completada: [],
  cancelada: [],
};

export const ACCION_CITA = {
  confirmada: 'Confirmar',
  completada: 'Marcar como completada',
  cancelada: 'Cancelar cita',
};

// Las columnas DATE llegan como "2026-11-05..." y no deben correrse un día por la zona horaria.
export function soloFecha(v) {
  if (!v) return null;
  const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const formatoFecha = (v) =>
  v ? soloFecha(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';

export const formatoFechaHora = (v) =>
  v
    ? new Date(v).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : 'Sin fecha';

export const formatoNumero = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 3 });
