module.exports = (ordenService) => ({
  crear: async (req, res, next) => {
    try { res.status(201).json(await ordenService.crear(req.body, req.user)); } catch (e) { next(e); }
  },
  listar: async (req, res, next) => {
    try { res.json(await ordenService.listar(req.query)); } catch (e) { next(e); }
  },
  obtener: async (req, res, next) => {
    try { res.json(await ordenService.obtener(req.params.id)); } catch (e) { next(e); }
  },
  cambiarEstado: async (req, res, next) => {
    try { res.json(await ordenService.cambiarEstado(req.params.id, req.body.estado, req.user)); } catch (e) { next(e); }
  },
});
