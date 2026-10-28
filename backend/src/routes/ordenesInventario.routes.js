// Ajusta los nombres del middleware de auth a los de tu proyecto.
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
router.use(authenticate);

router.post('/ordenes', oc.crear);
router.get('/ordenes', oc.listar);
router.get('/ordenes/:id', oc.obtener);
router.patch('/ordenes/:id/estado', oc.cambiarEstado);

router.get('/procedimientos', async (req, res, next) => {
     try {
       const r = await db.query('SELECT id, nombre FROM tipos_procedimiento ORDER BY nombre');
       res.json(r.rows);
     } catch (e) {
       next(e);
     }
   });

router.get('/inventario', ic.listarInsumos);
router.get('/inventario/alertas', ic.listarAlertas);
router.post('/inventario', authorize('admin'), ic.crearInsumo);
router.post('/inventario/:id/movimientos', ic.registrarMovimiento);

module.exports = router; // app.use('/api', router)
