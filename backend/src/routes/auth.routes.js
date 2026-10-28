const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middlewares/auth');
const controller = require('../controllers/auth.controller');

router.post('/login', asyncHandler(controller.login));

// Solo un administrador puede crear usuarios nuevos
router.post('/register', authenticate, authorize('admin'), asyncHandler(controller.registrar));

router.get('/me', authenticate, asyncHandler(controller.perfil));

module.exports = router;
