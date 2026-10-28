// Ciclo de estados de una orden de trabajo (coincide con el CHECK de la tabla ordenes_trabajo).
// Pendiente de confirmar con Miguel Torres que sean los que usan en la práctica.
const ESTADOS = ['recibido', 'en_modelado', 'en_coccion_acabado', 'control_calidad', 'terminado', 'entregado'];

const TRANSICIONES = {
  recibido: ['en_modelado'],
  en_modelado: ['en_coccion_acabado'],
  en_coccion_acabado: ['control_calidad'],
  control_calidad: ['terminado', 'en_coccion_acabado'], // retrabajo si no pasa calidad
  terminado: ['entregado'],
  entregado: [],
};

// Estado en el que se descuentan los insumos (cuando empieza la producción).
const ESTADO_DESCUENTO = 'en_modelado';

function puedeTransitar(desde, hacia) {
  return (TRANSICIONES[desde] || []).includes(hacia);
}

module.exports = { ESTADOS, TRANSICIONES, ESTADO_DESCUENTO, puedeTransitar };
