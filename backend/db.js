const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'shasa_tech',
    password: 'mjnns',
    port: 5432,
});

module.exports = pool;