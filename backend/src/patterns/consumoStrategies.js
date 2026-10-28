// Patrón Strategy: cómo se calcula el consumo de un insumo según la receta.
const estrategias = {
  // Se consume `cantidad` por cada unidad (pieza) de la orden. Ej.: 2 g de cerámica por corona.
  por_unidad: (receta, unidades) => receta.cantidad * unidades,
  // Se consume `cantidad` una sola vez por orden, sin importar las unidades.
  fijo: (receta) => receta.cantidad,
};

function calcularConsumo(receta, unidades) {
  const modo = receta.modo_consumo || 'por_unidad';
  const estrategia = estrategias[modo];
  if (!estrategia) throw new Error(`Modo de consumo desconocido: ${modo}`);
  return Number(estrategia({ ...receta, cantidad: Number(receta.cantidad) }, unidades).toFixed(3));
}

module.exports = { calcularConsumo, estrategias };
