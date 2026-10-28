// Error controlado: lleva un código HTTP y un mensaje seguro para mostrar al cliente.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = AppError;
