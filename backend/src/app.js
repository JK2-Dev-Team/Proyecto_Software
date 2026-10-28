const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use('/api', require('./routes/ordenesInventario.routes'));
app.use('/api', require('./routes/reportes.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
