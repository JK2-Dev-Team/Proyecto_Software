# Frontend – Laboratorio Dental Miguel Torres

React + Vite + Axios + React Router. Secciones: órdenes de trabajo (tablero por etapas), citas, inventario y clientes.

## Arranque local
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy de /api a http://localhost:3000)
```

## Despliegue en Vercel
1. Importa el repositorio y en *Root Directory* escribe `frontend`.
2. Variable de entorno `VITE_API_URL` = `https://TU-BACKEND.onrender.com/api`.
3. `vercel.json` ya redirige todas las rutas a `index.html`.
4. En el backend (Render), habilita CORS para el dominio de Vercel.

## Endpoints que la interfaz espera
| Uso | Método y ruta |
|---|---|
| Login | `POST /auth/login` → `{ token, user: { nombre, email, rol } }` |
| Clientes | `GET /clientes`, `POST /clientes` (`nombre`, `telefono`, `email`) |
| Procedimientos | `GET /procedimientos` → `[{ id, nombre }]` |
| Citas | `GET /citas?estado=`, `POST /citas` (`cliente_id`, `fecha`, `notas`), `PATCH /citas/:id/estado` |
| Órdenes | `GET/POST /ordenes`, `GET /ordenes/:id`, `PATCH /ordenes/:id/estado` |
| Inventario | `GET /inventario?bajoStock=true`, `GET /inventario/alertas`, `POST /inventario`, `POST /inventario/:id/movimientos` |

Los errores se leen de `error` o `message` en el cuerpo de la respuesta. Si algún nombre difiere en tu backend, se ajusta en `src/services/services.js`.
