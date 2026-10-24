
const express = require("express");

const aplicacion = express();

const controladorInventario = require("./controllers/inventario.controller");

aplicacion.use(express.json());

aplicacion.get("/", (solicitud, respuesta) => {
    respuesta.json({
        mensaje: "Sistema de Gestión del Laboratorio Dental Miguel Torres",
        estado: "Servidor funcionando correctamente"
    });
});

aplicacion.get(
    "/api/inventario",
    controladorInventario.obtenerTodos
);

aplicacion.post(
    "/api/inventario",
    controladorInventario.guardar
);

module.exports = aplicacion;
