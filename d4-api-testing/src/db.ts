import 'dotenv/config';
import { Pool } from 'pg';

const dbName = process.env.NODE_ENV === 'test' ? process.env.TEST_DB_NAME : process.env.DB_NAME
if (!dbName) {
    throw new Error('Database name missing: check DB_NAME / TEST_DB_NAME in .env')
}

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: dbName,
    user: process.env.DB_USER,
})
