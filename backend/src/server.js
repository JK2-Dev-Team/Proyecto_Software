const config = require('./config/env');

if (!config.jwtSecret || !config.databaseUrl) {
  console.error('Faltan variables de entorno: define JWT_SECRET y DATABASE_URL (ver .env.example)');
  process.exit(1);
}

const app = require('./app');

app.listen(config.port, () => {
  console.log(`API del Laboratorio Dental escuchando en el puerto ${config.port}`);
});
