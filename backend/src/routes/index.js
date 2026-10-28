const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');

router.use('/auth', require('./auth.routes'));

// Todo lo demás exige sesión iniciada
router.use('/clientes', authenticate, require('./clientes.routes'));
router.use('/citas', authenticate, require('./citas.routes'));

module.exports = router;
