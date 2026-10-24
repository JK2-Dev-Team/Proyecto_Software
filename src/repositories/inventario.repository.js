
const pool = require("../config/database");

async function obtenerTodos() {
    const consulta = `
        SELECT id, nombre, cantidad, precio
        FROM inventario
        ORDER BY id ASC
    `;

    const resultado = await pool.query(consulta);

    return resultado.rows.map((producto) => ({
        id: producto.id,
        nombre: producto.nombre,
        cantidad: producto.cantidad,
        precio: Number(producto.precio)
    }));
}

async function guardar(producto) {
    const consulta = `
        INSERT INTO inventario (nombre, cantidad, precio)
        VALUES ($1, $2, $3)
        RETURNING id, nombre, cantidad, precio
    `;

    const valores = [
        producto.nombre,
        producto.cantidad,
        producto.precio
    ];

    const resultado = await pool.query(consulta, valores);
    const nuevoProducto = resultado.rows[0];

    return {
        id: nuevoProducto.id,
        nombre: nuevoProducto.nombre,
        cantidad: nuevoProducto.cantidad,
        precio: Number(nuevoProducto.precio)
    };
}

module.exports = {
    obtenerTodos,
    guardar
};
