// Manejo centralizado de errores: nunca se exponen datos crudos ni trazas al cliente
// (riesgo #2 de la matriz de privacidad).
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Errores de PostgreSQL más comunes
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia a un registro que no existe' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('Error interno:', err.message); // solo el mensaje, sin body ni datos del usuario
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  return res.status(status).json({ error: err.message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

module.exports = { errorHandler, notFound };
