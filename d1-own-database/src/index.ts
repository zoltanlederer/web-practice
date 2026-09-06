import { pool } from './db.js';
import express from 'express';
import type { Request, Response } from 'express';

const app = express()
app.use(express.json())

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

app.get('/movies/:id', async (req: Request, res: Response) => {
    let client
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid id' })
            return
        }
        client = await pool.connect()
        const result = await client.query('SELECT * FROM movies WHERE id = $1', [id])
        if (!result.rows[0]) {
            res.status(404).json({ error: "'id' not found" })
            return
        }
        res.json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to fecth movie' })
    } finally {
        client?.release()
    }
});

app.post('/movies', async (req: Request, res: Response) => {
    let client;
    try {
        const { title, year, rating, watched } = req.body
        if (!title) {
            res.status(400).json({ error: 'title is required' })
            return
        }
        client = await pool.connect()
        const result = await client.query('INSERT INTO movies(title, year, rating, watched) VALUES($1, $2, $3, $4) RETURNING *', [title, year, rating, watched])
        res.status(201).json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to create movie' })
    } finally {
        client?.release()
    }
});

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})