import { pool } from './db.js';
import express from 'express';
import type { Request, Response } from 'express';

const app = express()
app.use(express.json())

app.get('/movies', async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect()

        // LEFT JOIN (not JOIN) so movies with zero genres still appear —
        // an inner JOIN would silently drop them since they have no movie_genres row.
        // array_agg collects each movie's genre names into one array; FILTER strips out
        // the NULL that appears for genre-less movies (from the LEFT JOIN); COALESCE
        // then converts that leftover NULL into a clean empty array instead.
        const query = `
            SELECT movies.id, movies.title, movies.year, movies.rating, movies.watched,
                   COALESCE(array_agg(genres.name) FILTER (WHERE genres.name IS NOT NULL), '{}') AS genres
            FROM movies
            LEFT JOIN movie_genres ON movies.id = movie_genres.movie_id
            LEFT JOIN genres ON movie_genres.genre_id = genres.id
            GROUP BY movies.id;`

        const result = await client.query(query) 
        res.json(result.rows)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to fetch movies' })
    } finally {
        // Runs whether the query succeeded or threw — without this, a failed query
        // would leak the connection out of the pool permanently.
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
        const query = `
            SELECT movies.id, movies.title, movies.year, movies.rating, movies.watched,
                    COALESCE(array_agg(genres.name) FILTER (WHERE genres.name IS NOT NULL), '{}') AS genres
            FROM movies
            LEFT JOIN movie_genres ON movies.id = movie_genres.movie_id
            LEFT JOIN genres ON movie_genres.genre_id = genres.id
            WHERE movies.id = $1
            GROUP BY movies.id;`    
        const result = await client.query(query, [id])
        if (!result.rows[0]) {
            res.status(404).json({ error: "'id' not found" })
            return
        }
        res.json(result.rows[0])
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to fetch movie' })
    } finally {
        client?.release()
    }
});

app.post('/movies', async (req: Request, res: Response) => {
    let client;
    try {
        const { title, year, rating, watched, genre_ids } = req.body
        // Validate before touching the database — a missing title would otherwise
        // hit Postgres's NOT NULL constraint and return a confusing 500 instead of a clear 400.
        if (!title) {
            res.status(400).json({ error: 'title is required' })
            return
        }
        client = await pool.connect()

        // Wrap the movie insert + genre links in a transaction: both must succeed together,
        // since a movie with only some of its genres attached would be an inconsistent state.
        await client.query('BEGIN');
        try {
            const result = await client.query('INSERT INTO movies(title, year, rating, watched) VALUES($1, $2, $3, $4) RETURNING *', [title, year, rating, watched])
            const movie = result.rows[0]

            // genre_ids is optional — only attempt linking if it was actually provided as an array.
            // One INSERT per id, since a movie can have multiple genres (many-to-many via movie_genres).
            if (genre_ids && Array.isArray(genre_ids)) {
                for (const genreId of genre_ids) {
                    await client.query('INSERT INTO movie_genres(movie_id, genre_id) VALUES($1, $2)', [movie.id, genreId])
                }
            }

            // Only commit — and only respond to the client — once every insert above has succeeded.
            await client.query('COMMIT');
            res.status(201).json(movie)
        } catch (err) {
            // Something failed (e.g. an invalid genre_id violating the foreign key) —
            // undo the movie insert too, so we never leave a half-created movie behind.
            await client.query('ROLLBACK');
            throw err // re-throw so the outer catch still sends an error response to the client
        }
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
        // PUT expects the full object every time — unlike PATCH, any field left out
        // here would overwrite existing data with NULL, since all four columns are always SET.
        const { title, year, rating, watched } = req.body
        if (!title) {
            res.status(400).json({ error: 'title is required' })
            return
        }
        client = await pool.connect()
        // WHERE id=$5 is required — an UPDATE with no WHERE clause would overwrite every row in the table.
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
        const { title, year, rating, watched, genre_ids } = req.body

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
        if (fields.length === 0 && !genre_ids) {
            res.status(400).json({ error: 'No fields provided to update' })
            return
        }

        // id goes last, since it's the final $N placeholder after all the SET fields.
        values.push(id)

        client = await pool.connect()
        await client.query('BEGIN');
        try {
            let result
            if (fields.length > 0){
                const query = `UPDATE movies SET ${fields.join(', ')} WHERE id=$${paramIndex} RETURNING *`
                result = await client.query(query, values)
            } else {
                result = await client.query('SELECT * FROM movies WHERE id=$1', [id])
            }
            
            const movie = result.rows[0]

            // No row matched that id — nothing was updated.
            if (!movie) {
                await client.query('ROLLBACK');
                res.status(404).json({ error: 'id not found' })
                return
            }  

            if (genre_ids && Array.isArray(genre_ids)) {
                await client.query('DELETE FROM movie_genres WHERE movie_id = $1', [movie.id])
                for (const genreId of genre_ids) {
                    await client.query('INSERT INTO movie_genres(movie_id, genre_id) VALUES($1, $2)', [movie.id, genreId])
                }
            }

            await client.query('COMMIT');
            res.json(movie)
        } catch (err) {
            await client.query('ROLLBACK');
            throw err
        }
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
        // WHERE id=$1 is required — a DELETE with no WHERE clause removes every row in the table, permanently.
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

app.get('/genres', async (req: Request, res: Response) => {
    let client;
    try {
        client = await pool.connect()
        const query = await client.query('SELECT * FROM genres')  
        res.json(query.rows)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: 'Failed to fetch genres' })
    } finally {
        client?.release()
    }
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})