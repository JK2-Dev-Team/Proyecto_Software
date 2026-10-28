const express = require('express');
const { authenticate } = require('../middlewares/auth');
const db = require('../db/connection');
const { createReporteService } = require('../services/reporteService');

const reportes = createReporteService({ db });
const rc = require('../controllers/reporteController')(reportes);

const router = express.Router();

// authenticate va en cada ruta (no con router.use) para que las rutas
// inexistentes sigan llegando al manejador 404 de la app.
// Para que solo el administrador vea los reportes, agrega authorize('admin') después de authenticate.
router.get('/reportes/ordenes', authenticate, rc.ordenes);
router.get('/reportes/consumo-insumos', authenticate, rc.consumoInsumos);
router.get('/reportes/citas', authenticate, rc.citasSemanales);

module.exports = router;
