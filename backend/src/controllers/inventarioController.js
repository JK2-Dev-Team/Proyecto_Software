module.exports = (inv) => ({
  crearInsumo: async (req, res, next) => {
    try { res.status(201).json(await inv.crearInsumo(req.body)); } catch (e) { next(e); }
  },
  listarInsumos: async (req, res, next) => {
    try { res.json(await inv.listarInsumos({ bajoStock: req.query.bajoStock === 'true' })); } catch (e) { next(e); }
  },
  registrarMovimiento: async (req, res, next) => {
    try {
      const evento = await inv.registrarMovimiento({ ...req.body, insumo_id: req.params.id, usuario_id: req.user?.id });
      res.status(201).json(evento);
    } catch (e) { next(e); }
  },
  listarAlertas: async (req, res, next) => {
    try { res.json(await inv.listarAlertas()); } catch (e) { next(e); }
  },
});
