const AppError = require('./AppError');

function parseId(valor, campo = 'id') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(`${campo} inválido`, 400);
  }
  return n;
}

function textoRequerido(valor, campo, max = 255) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new AppError(`${campo} es obligatorio`, 400);
  }
  if (valor.trim().length > max) {
    throw new AppError(`${campo} no puede superar ${max} caracteres`, 400);
  }
  return valor.trim();
}

function textoOpcional(valor, max = 1000) {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = String(valor).trim();
  if (texto.length > max) {
    throw new AppError(`El texto no puede superar ${max} caracteres`, 400);
  }
  return texto;
}

function fechaValida(valor, campo = 'fecha') {
  const fecha = new Date(valor);
  if (!valor || Number.isNaN(fecha.getTime())) {
    throw new AppError(`${campo} no es una fecha válida`, 400);
  }
  return fecha;
}

function emailValido(valor) {
  const email = textoRequerido(valor, 'email', 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('email no tiene un formato válido', 400);
  }
  return email;
}

module.exports = { parseId, textoRequerido, textoOpcional, fechaValida, emailValido };
