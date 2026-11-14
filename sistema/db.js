import pg from 'pg';

const { Pool, types } = pg;

types.setTypeParser(1082, (valor) => valor);

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'clinica_pediatrica',
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT) || 7777,
});

export default pool;
