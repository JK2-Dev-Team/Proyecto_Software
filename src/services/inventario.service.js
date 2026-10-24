
const inventarioRepository = require("../repositories/inventario.repository");

async function obtenerTodos() {
    return await inventarioRepository.obtenerTodos();
}

async function guardar(producto) {
    if (!producto.nombre || typeof producto.nombre !== "string" || !producto.nombre.trim()) {
        throw new Error("El nombre del producto es obligatorio");
    }

    if (!Number.isInteger(producto.cantidad) || producto.cantidad < 0) {
        throw new Error("La cantidad debe ser un entero mayor o igual a cero");
    }

    if (
        typeof producto.precio !== "number" ||
        !Number.isFinite(producto.precio) ||
        producto.precio < 0
    ) {
        throw new Error("El precio debe ser un número mayor o igual a cero");
    }

    return await inventarioRepository.guardar({
        nombre: producto.nombre.trim(),
        cantidad: producto.cantidad,
        precio: producto.precio
    });
}

module.exports = {
    obtenerTodos,
    guardar
};
