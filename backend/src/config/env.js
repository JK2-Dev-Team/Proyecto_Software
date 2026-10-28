require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL !== 'false',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h', // sesión expira (riesgo #6 de la matriz de privacidad)
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
