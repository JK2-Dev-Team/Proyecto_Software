module.exports = (usuarios) => ({
  listar: async (req, res, next) => {
    try { res.json(await usuarios.listar()); } catch (e) { next(e); }
  },
  crear: async (req, res, next) => {
    try { res.status(201).json(await usuarios.crear(req.body)); } catch (e) { next(e); }
  },
  actualizar: async (req, res, next) => {
    try { res.json(await usuarios.actualizar(req.user.id, req.params.id, req.body)); } catch (e) { next(e); }
  },
  restablecerPassword: async (req, res, next) => {
    try {
      await usuarios.restablecerPassword(req.params.id, (req.body || {}).password);
      res.status(204).end();
    } catch (e) { next(e); }
  },
});
