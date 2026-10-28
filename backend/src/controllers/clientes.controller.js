const clientesService = require('../services/clientes.service');

async function listar(req, res) {
  res.json(await clientesService.listar(req.query));
}

async function obtener(req, res) {
  res.json(await clientesService.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await clientesService.crear(req.body));
}

async function actualizar(req, res) {
  res.json(await clientesService.actualizar(req.params.id, req.body));
}

module.exports = { listar, obtener, crear, actualizar };
