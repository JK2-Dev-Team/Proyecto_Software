// Patrón Singleton: una única instancia del pool de conexiones a PostgreSQL
// compartida por toda la aplicación.
const { Pool } = require('pg');
const config = require('../config/env');

let instance = null;

class Database {
  constructor() {
    if (instance) {
      return instance; // si ya existe una instancia, la reutiliza
    }

    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
    });

    instance = this;
  }

  getPool() {
    return this.pool;
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }
}

module.exports = new Database();
