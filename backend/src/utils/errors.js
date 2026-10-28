const BaseAppError = require('./AppError');

// Adaptador: mis módulos escriben new AppError(409, 'mensaje');
// esto lo convierte a tu clase, que recibe (mensaje, estado).
class AppError extends BaseAppError {
  constructor(status, message) {
    super(message, status);
  }
}

module.exports = { AppError };