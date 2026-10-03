import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'

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
})