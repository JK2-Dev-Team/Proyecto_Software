const authService = require('../services/auth.service');

async function login(req, res) {
  const resultado = await authService.login(req.body);
  res.json(resultado);
}

async function registrar(req, res) {
  const usuario = await authService.registrar(req.body);
  res.status(201).json(usuario);
}

async function perfil(req, res) {
  const usuario = await authService.obtenerPerfil(req.user.id);
  res.json(usuario);
}

module.exports = { login, registrar, perfil };
