import { pool } from './db.js';

const client = await pool.connect()
const res = await client.query('SELECT NOW()')
console.log(res)
client.release()

await pool.end()