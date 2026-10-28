const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');

// Verifica el token JWT del encabezado "Authorization: Bearer <token>"
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return next(new AppError('Token de autenticación requerido', 401));
  }

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    req.user = { id: payload.id, rol: payload.rol, nombre: payload.nombre };
    return next();
  } catch (err) {
    return next(new AppError('Token inválido o expirado', 401));
  }
}

// Restringe un endpoint a ciertos roles (principio de mínimo privilegio)
function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return next(new AppError('No tienes permisos para realizar esta acción', 403));
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
