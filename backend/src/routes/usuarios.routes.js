const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const db = require('../db/connection');
const { createUsuarioService } = require('../services/usuarioService');

const usuarios = createUsuarioService({ db });
const uc = require('../controllers/usuarioController')(usuarios);

const router = express.Router();

// authenticate va en cada ruta (no con router.use) para que las rutas inexistentes
// sigan llegando al manejador 404 de la app. Toda la gestión de usuarios es solo para administradores.
const soloAdmin = [authenticate, authorize('admin')];

router.get('/usuarios', soloAdmin, uc.listar);
router.post('/usuarios', soloAdmin, uc.crear);
router.patch('/usuarios/:id', soloAdmin, uc.actualizar);
router.put('/usuarios/:id/password', soloAdmin, uc.restablecerPassword);

module.exports = router;
