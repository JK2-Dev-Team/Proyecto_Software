module.exports = (reportes) => ({
  ordenes: async (req, res, next) => {
    try { res.json(await reportes.ordenes(req.query)); } catch (e) { next(e); }
  },
  consumoInsumos: async (req, res, next) => {
    try { res.json(await reportes.consumoInsumos(req.query)); } catch (e) { next(e); }
  },
  citasSemanales: async (req, res, next) => {
    try { res.json(await reportes.citasSemanales(req.query)); } catch (e) { next(e); }
  },
});
