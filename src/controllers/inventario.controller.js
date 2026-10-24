
const inventarioService = require("../services/inventario.service");

async function obtenerTodos(req, res) {
    try {
        const productos = await inventarioService.obtenerTodos();
        return res.status(200).json(productos);
    } catch (error) {
        console.error("Error al consultar el inventario:", error.message);
        return res.status(500).json({
            mensaje: "Error al consultar el inventario"
        });
    }
}

async function guardar(req, res) {
    try {
        const nuevoProducto = await inventarioService.guardar(req.body);
        return res.status(201).json(nuevoProducto);
    } catch (error) {
        if (
            error.message === "El nombre del producto es obligatorio" ||
            error.message === "La cantidad debe ser un entero mayor o igual a cero" ||
            error.message === "El precio debe ser un número mayor o igual a cero"
        ) {
            return res.status(400).json({
                mensaje: error.message
            });
        }

        console.error("Error al guardar el producto:", error.message);
        return res.status(500).json({
            mensaje: "Error al guardar el producto"
        });
    }
}

module.exports = {
    obtenerTodos,
    guardar
};
