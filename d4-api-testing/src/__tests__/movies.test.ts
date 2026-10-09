import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.js'

// Empty every table BEFORE each test (not after): even if a test crashes halfway,
// the next one still starts clean, and failed data stays in the DB for inspection.
beforeEach(async () => {
    await resetDb()
})

// The pg pool keeps idle connections open for reuse, which keeps Node alive.
// Closing it after the last test lets Jest exit cleanly.
afterAll(async () => {
    await pool.end()
})

describe('GET /movies', () => {
    it('returns 200 and an empty array when there are no movies', async () => {
        const res = await request(app).get('/movies')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns 200 and movies with their genre names', async () => {
        // Drama is inserted before Comedy on purpose: alphabetical order differs from
        // insertion order, so this only passes if array_agg's ORDER BY really sorts.
        await pool.query("INSERT INTO genres (name) VALUES ('Drama'), ('Comedy')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('Doctor Strange', 2016, 7.5, true)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1), (1, 2)")
        const res = await request(app).get('/movies')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([
            {
                id: 1,
                title: 'Doctor Strange',
                year: 2016,
                // pg returns NUMERIC columns as strings (to avoid floating-point rounding),
                // so rating comes back as '7.5', not 7.5. Same for every rating below.
                rating: '7.5',
                watched: true,
                genres: ['Comedy', 'Drama']
            }
        ])
    })

    it('returns 200 and an empty genres array for a movie with no genres', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('Doctor Strange', 2016, 7.5, true)")
        const res = await request(app).get('/movies')
        expect(res.status).toBe(200)
        // Checks the FILTER + COALESCE logic in the query: without it, this would be [null].
        expect(res.body[0].genres).toEqual([])
    })
})

describe('GET /movies/:id', () => {
    it('returns 200 and the movie when it exists', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        const res = await request(app).get('/movies/1')
        expect(res.status).toBe(200)
        expect(res.body).toEqual(
            {
                id: 1,
                title: 'The Avengers',
                year: 2012,
                rating: '8.3',
                watched: false,
                genres: []
            }
        )
    })

    it("returns 404 when the movie doesn't exist", async () => {
        const res = await request(app).get('/movies/1')
        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })

    it('returns 400 when the id is not a number', async () => {
        const res = await request(app).get('/movies/abc')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    // Number('1.5') is 1.5, not NaN, so the old isNaN check let it through and
    // Postgres rejected it for the INTEGER column → 500. Fixed with Number.isInteger.
    it('returns 400 when the id is not a whole number', async () => {
        const res = await request(app).get('/movies/1.5')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies', () => {
    it('returns 201 and creates the movie', async () => {
        const res = await request(app)
            .post('/movies')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: false })

        const result = await pool.query('SELECT * FROM movies')
        // Written by hand, not copied from the response: comparing the response with the
        // DB row would pass even if the insert saved wrong data (both come from RETURNING *).
        const expected = { id: 1, title: 'Thor', year: 2011, rating: '7.2', watched: false }

        expect(res.status).toBe(201)
        expect(res.body).toEqual(expected)
        // [expected] (not rows[0]) also proves there is exactly one row.
        expect(result.rows).toEqual([expected])
    })

    it('returns 400 when title is missing', async () => {
        const res = await request(app)
            .post('/movies')
            .send({ year: 2011, rating: 7.2, watched: false })

        const result = await pool.query('SELECT * FROM movies')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([])
    })

    it("returns 400 and saves nothing when a genre id doesn't exist", async () => {
        // genre 1 exists, so the first link succeeds before 999 fails
        await pool.query("INSERT INTO genres (name) VALUES ('Action')")

        const res = await request(app)
            .post('/movies')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: false, genre_ids: [1, 999] })

        const movies = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        const genres = await pool.query('SELECT * FROM genres')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(movies.rows).toEqual([]) // the movie insert was undone
        expect(links.rows).toEqual([])  // the successful genre 1 link was undone too
        expect(genres.rows).toEqual([{ id: 1, name: 'Action' }])  // data from before the request is untouched
    })
})

describe('PUT /movies/:id', () => {
    it('returns 200 and replaces all fields', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        // Every field changes, so the test can tell "updated" apart from "left as it was" for each one.
        const res = await request(app)
            .put('/movies/1')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: true })

        const result = await pool.query('SELECT * FROM movies')
        const expected = { id: 1, title: 'Thor', year: 2011, rating: '7.2', watched: true }
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expected)
        expect(result.rows).toEqual([expected])
    })

    it("returns 200 and replaces the movie's genres", async () => {
        // The movie starts linked to genre 1 only and the request sends [2], so the result
        // proves both halves of "replace": the old link removed AND the new one added.
        await pool.query("INSERT INTO genres (name) VALUES ('Drama'), ('Comedy')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

        const res = await request(app)
            .put('/movies/1')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: true, genre_ids: [2] })

        const result = await pool.query('SELECT * FROM movie_genres')
        const expected = { movie_id: 1, genre_id: 2 }
        expect(res.status).toBe(200)
        expect(result.rows).toEqual([expected])
    })

    it("returns 404 when the movie doesn't exist", async () => {
        // A valid body (title included) is required to get past the 400 check and reach the 404.
        const res = await request(app)
            .put('/movies/999')
            .send({ title: 'Thor' })

        const result = await pool.query('SELECT * FROM movies')
        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([])
    })

    it("returns 400 and changes nothing when a genre id doesn't exist", async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

        const res = await request(app)
            .put('/movies/1')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: true, genre_ids: [999] })

        const result = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        // Every field was changed in the request, so the original row proves the UPDATE was rolled back.
        expect(result.rows).toEqual([{ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false }])
        // The route deletes the old links before inserting new ones, so link 1 surviving
        // proves the rollback restored deleted data too, not just removed new data.
        expect(links.rows).toEqual([{ movie_id: 1, genre_id: 1 }])
    })
})

describe('PATCH /movies/:id', () => {
    it('returns 200 and updates only the fields sent', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        const res = await request(app)
            .patch('/movies/1')
            .send({ title: 'Thor', watched: true })

        const result = await pool.query('SELECT * FROM movies')
        // year and rating keep their original values: if the route behaved like PUT,
        // the fields not sent would become null and this would fail.
        const expected = { id: 1, title: 'Thor', year: 2012, rating: '8.3', watched: true }
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expected)
        expect(result.rows).toEqual([expected])
    })

    it("returns 400 and changes nothing when a genre id doesn't exist", async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

        // A field change is sent together with the bad genre id, so the route runs the
        // UPDATE branch (not the SELECT-only branch), and the rollback of that UPDATE is tested too.
        const res = await request(app)
            .patch('/movies/1')
            .send({ title: 'Thor', genre_ids: [999] })

        const result = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([{ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false }])
        expect(links.rows).toEqual([{ movie_id: 1, genre_id: 1 }])
    })
})

describe('DELETE /movies/:id', () => {
    // Tokens are signed directly with jwt.sign instead of going through /register and /login,
    // so these tests only depend on DELETE + requireAuth (login has its own tests in auth.test.ts).
    // requireAuth only checks the signature, never the database, so this token is just as valid.

    it('returns 401 and deletes nothing without a token', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        const res = await request(app)
            .delete('/movies/1')

        const result = await pool.query('SELECT * FROM movies')
        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        // A 401 is only half the promise: the protected action must not have happened.
        expect(result.rows).toEqual([{ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false }])
    })

    it('returns 401 and deletes nothing with a forged token', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        // Correct format and a believable payload; only the secret is wrong.
        // Compared with the valid-token test below, the signature is the only difference.
        const token = jwt.sign({ id: 1 }, 'not-the-real-secret')
        const res = await request(app)
            .delete('/movies/1')
            .set('Authorization', `Bearer ${token}`)

        const result = await pool.query('SELECT * FROM movies')
        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([{ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false }])
    })

    it('returns 200 and deletes the movie and its genre links with a valid token', async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

        const token = jwt.sign({ id: 1 }, JWT_SECRET)
        const res = await request(app)
            .delete('/movies/1')
            .set('Authorization', `Bearer ${token}`)

        const result = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false })
        expect(result.rows).toEqual([])
        // The route only deletes from movies: the links disappear because of
        // ON DELETE CASCADE in the schema, so this checks a promise of the schema itself.
        expect(links.rows).toEqual([])
    })

    it("returns 404 with a valid token when the movie doesn't exist", async () => {
        // The valid token gets the request past requireAuth, so the route's own
        // not-found handling is what's being tested here.
        const token = jwt.sign({ id: 1 }, JWT_SECRET)
        const res = await request(app)
            .delete('/movies/999')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})