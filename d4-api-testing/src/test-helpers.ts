import { pool } from './db.js';

export const resetDb = async () => {
    const result = await pool.query('SELECT current_database()')
    const currentDb = result.rows[0]?.current_database
    if (currentDb !== process.env.TEST_DB_NAME) {
        throw new Error(`Refusing to reset: connected to "${currentDb}", expected "${process.env.TEST_DB_NAME}"`)
    }
    await pool.query('TRUNCATE movies, genres, movie_genres, users RESTART IDENTITY CASCADE;')
}