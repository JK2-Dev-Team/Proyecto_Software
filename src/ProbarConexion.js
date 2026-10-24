
const pool = require("./config/database");

async function probarConexion() {
    try {
        const resultado = await pool.query("SELECT NOW() AS fecha_actual");

        console.log("¡Conexión exitosa con PostgreSQL!");
        console.log("Fecha del servidor:", resultado.rows[0].fecha_actual);
    } catch (error) {
        console.error("Error al conectar con PostgreSQL:", error.message);
    } finally {
        await pool.end();
    }
}

probarConexion();
