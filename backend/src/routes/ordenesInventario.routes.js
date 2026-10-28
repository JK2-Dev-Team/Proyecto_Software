const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const db = require('../db/connection');
const { StockSubject, AlertaStockBajoObserver } = require('../patterns/stockSubject');
const { createInventarioService } = require('../services/inventarioService');
const { createOrdenService } = require('../services/ordenService');

const subject = new StockSubject();
subject.subscribe(new AlertaStockBajoObserver(db));

const inventario = createInventarioService({ db, subject });
const ordenes = createOrdenService({ db, inventario, subject });
const oc = require('../controllers/ordenController')(ordenes);
const ic = require('../controllers/inventarioController')(inventario);

const router = express.Router();

// authenticate va en cada ruta (no con router.use) para que las rutas
// inexistentes sigan llegando al manejador 404 de la app.
router.post('/ordenes', authenticate, oc.crear);
router.get('/ordenes', authenticate, oc.listar);
router.get('/ordenes/:id', authenticate, oc.obtener);
router.patch('/ordenes/:id/estado', authenticate, oc.cambiarEstado);

router.get('/procedimientos', authenticate, async (req, res, next) => {
  try {
    const r = await db.query('SELECT id, nombre FROM tipos_procedimiento ORDER BY nombre');
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

router.get('/inventario', authenticate, ic.listarInsumos);
router.get('/inventario/alertas', authenticate, ic.listarAlertas);
router.post('/inventario', authenticate, authorize('admin'), ic.crearInsumo);
router.post('/inventario/:id/movimientos', authenticate, ic.registrarMovimiento);

module.exports = router;