import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.js'

beforeEach(async () => {
    await resetDb()
})

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
            rating: '7.5',
            watched: true,
            genres: [ 'Comedy', 'Drama' ]
            }
        ])
    })

    it('returns 200 and an empty genres array for a movie with no genres', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('Doctor Strange', 2016, 7.5, true)")
        const res = await request(app).get('/movies')
        expect(res.status).toBe(200)
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
        const expected = { id:1, title: 'Thor', year: 2011, rating: '7.2', watched: false }

        expect(res.status).toBe(201)
        expect(res.body).toEqual(expected)
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
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: false, genre_ids: [1, 999]})
        
        const movies = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        const genres = await pool.query('SELECT * FROM genres')
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(movies.rows).toEqual([]) // the movie insert was undone
        expect(links.rows).toEqual([])  // the successful genre 1 link was undone too
        expect(genres.rows).toEqual([ { id: 1, name: 'Action' } ])  // data from before the request is untouched
    })
})

describe('PUT /movies/:id', () => {
    it('returns 200 and replaces all fields', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        const res = await request(app)
            .put('/movies/1')
            .send({ title: 'Thor', year: 2011, rating: 7.2, watched: true })

        const result = await pool.query('SELECT * FROM movies')
        const expected = { id:1, title: 'Thor', year: 2011, rating: '7.2', watched: true }
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expected)
        expect(result.rows).toEqual([expected])
    })

    it("returns 200 and replaces the movie's genres", async () => {
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
        expect(result.rows).toEqual([{ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false }])
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
        const expected = { id:1, title: 'Thor', year: 2012, rating: '8.3', watched: true }
        expect(res.status).toBe(200)
        expect(res.body).toEqual(expected)
        expect(result.rows).toEqual([expected])
    })

    it("returns 400 and changes nothing when a genre id doesn't exist", async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

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
    it('returns 401 and deletes nothing without a token', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")

        const res = await request(app)
            .delete('/movies/1')
        
        const result = await pool.query('SELECT * FROM movies')            
        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([ { id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false } ])
    })
    
    it('returns 401 and deletes nothing with a forged token', async () => {
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        
        const token = jwt.sign({ id: 1 }, 'not-the-real-secret')
        const res = await request(app)
            .delete('/movies/1')
            .set('Authorization', `Bearer ${token}`)
        
        const result = await pool.query('SELECT * FROM movies')
        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toEqual([ { id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false } ])
    })

    it('returns 200 and deletes the movie and its genre links with a valid token', async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama')")
        await pool.query("INSERT INTO movies (title, year, rating, watched) VALUES ('The Avengers', 2012, 8.3, false)")
        await pool.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)")

        const token = jwt.sign({ id: 1}, JWT_SECRET)
        const res = await request(app)
            .delete('/movies/1')
            .set('Authorization', `Bearer ${token}`)
        
        const result = await pool.query('SELECT * FROM movies')
        const links = await pool.query('SELECT * FROM movie_genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ id: 1, title: 'The Avengers', year: 2012, rating: '8.3', watched: false })
        expect(result.rows).toEqual([])
        expect(links.rows).toEqual([])
    })
})