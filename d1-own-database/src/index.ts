import { pool } from './db.js';
import express from 'express';
import type { Request, Response } from 'express';
import { Client } from 'pg';

const app = express()

app.get('/movies', async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect()
        const query = await client.query('SELECT * FROM movies')  
        res.json(query.rows)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to fetch movies' })
    } finally {
        client?.release()
    }
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})