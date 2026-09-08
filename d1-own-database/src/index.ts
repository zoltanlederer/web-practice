import { pool } from './db.js';
import express from 'express';
import type { Request, Response } from 'express';
import { error } from 'node:console';
import { fileURLToPath } from 'node:url';

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

app.put('/movies/:id', async (req: Request, res: Response) => {
    let client
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            res.status(400).json({ error: 'invalid id' })
            return
        }
        const { title, year, rating, watched } = req.body
        if (!title) {
            res.status(400).json({ error: 'title is required' })
            return
        }
        client = await pool.connect()
        const result = await client.query('UPDATE movies SET title=$1, year=$2, rating=$3, watched=$4 WHERE id=$5 RETURNING *', [title, year, rating, watched, id])
        if (!result.rows[0]) {
            res.status(404).json({ error: 'id not found' })
            return
        }
        res.json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'update failed' })
    } finally {
        client?.release()
    }
});

// PATCH /movies/:id — partial update: only fields present in the body get updated,
// anything omitted stays unchanged in the database.
app.patch('/movies/:id', async (req: Request, res: Response) => {
    let client
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            res.status(400).json({ error: 'invalid id' })
            return
        }

        // Pull out whichever fields the client sent — missing ones become undefined.
        const { title, year, rating, watched } = req.body

        // Build the SET clause and its parameter values dynamically,
        // since we don't know in advance which fields were provided.
        const fields: string[] = []   // e.g. ["title=$1", "watched=$2"]
        const values: any[] = []      // e.g. ["Thor 2", false]
        let paramIndex = 1            // tracks $1, $2, $3... as fields are added

        // Bundle the possible columns into one object so we can loop over them
        // instead of writing a separate "if" block for each field.
        const updates: Record<string, unknown> = { title, year, rating, watched }

        for (const [key, value] of Object.entries(updates)) {
            // Skip any field the client didn't send (still undefined) —
            // only build SET clauses for fields that were actually provided.
            if (value !== undefined) {
                fields.push(`${key}=$${paramIndex}`)
                values.push(value)
                paramIndex++
            }
        }

        // If the client sent an empty body (or all-unknown keys), there's nothing to update.
        if (fields.length === 0) {
            res.status(400).json({ error: 'No fields provided to update' })
            return
        }

        // id goes last, since it's the final $N placeholder after all the SET fields.
        values.push(id)
        const query = `UPDATE movies SET ${fields.join(', ')} WHERE id=$${paramIndex} RETURNING *`

        client = await pool.connect()
        const result = await client.query(query, values)

        // No row matched that id — nothing was updated.
        if (!result.rows[0]) {
            res.status(404).json({ error: 'id not found' })
            return
        }

        res.json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'update failed' })
    } finally {
        // Always release the client back to the pool, even if something threw above.
        client?.release()
    }
});

app.delete('/movies/:id', async (req: Request, res: Response) => {
    let client
    try {
        const id = Number(req.params.id)
        if (isNaN(id)) {
            res.status(400).json({ error: 'invalid id' })
            return
        }
        client = await pool.connect()
        const result = await client.query('DELETE FROM movies WHERE id=$1 RETURNING *', [id])
        if (!result.rows[0]) {
            res.status(404).json({ error: 'id not found' })
            return
        }
        res.json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'delete failed' })
    } finally {
        client?.release()
    }
});

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})