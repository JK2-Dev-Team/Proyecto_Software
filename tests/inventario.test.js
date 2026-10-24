
const solicitud = require("supertest");
const aplicacion = require("../src/app");
const pool = require("../src/config/database");

describe("Pruebas del módulo de inventario", () => {
    beforeEach(async () => {
        await pool.query("DELETE FROM inventario");
    });

    afterAll(async () => {
        await pool.end();
    });

    test("1. Debe consultar el inventario correctamente", async () => {
        const respuesta = await solicitud(aplicacion)
            .get("/api/inventario");

        expect(respuesta.status).toBe(200);
        expect(respuesta.body).toEqual([]);
    });

    test("2. Debe registrar un producto válido", async () => {
        const respuesta = await solicitud(aplicacion)
            .post("/api/inventario")
            .send({
                nombre: "Resina dental",
                cantidad: 10,
                precio: 25000
            });

        expect(respuesta.status).toBe(201);
        expect(respuesta.body.nombre).toBe("Resina dental");
        expect(respuesta.body.cantidad).toBe(10);
        expect(Number(respuesta.body.precio)).toBe(25000);
    });

    test("3. Debe rechazar un producto sin nombre", async () => {
        const respuesta = await solicitud(aplicacion)
            .post("/api/inventario")
            .send({
                cantidad: 10,
                precio: 25000
            });

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            "El nombre del producto es obligatorio"
        );
    });

    test("4. Debe rechazar una cantidad negativa", async () => {
        const respuesta = await solicitud(aplicacion)
            .post("/api/inventario")
            .send({
                nombre: "Resina dental",
                cantidad: -5,
                precio: 25000
            });

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            "La cantidad debe ser un entero mayor o igual a cero"
        );
    });
});
