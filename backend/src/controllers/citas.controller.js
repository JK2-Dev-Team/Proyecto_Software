const citasService = require('../services/citas.service');

async function listar(req, res) {
  res.json(await citasService.listar(req.query));
}

async function obtener(req, res) {
  res.json(await citasService.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await citasService.crear(req.body, req.user.id));
}

async function actualizar(req, res) {
  res.json(await citasService.actualizar(req.params.id, req.body));
}

// Cancelar una cita es un cambio de estado (no se borra el registro: queda trazabilidad)
async function cambiarEstado(req, res) {
  res.json(await citasService.cambiarEstado(req.params.id, req.body.estado));
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
