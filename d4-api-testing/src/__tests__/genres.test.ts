import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'

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

describe('GET /genres', () => {
    // The dev database has genres but the test database is empty, so this also
    // proves the tests are connected to the test database (NODE_ENV=test).
    it('returns 200 and an empty array when there are no genres', async () => {
        const res = await request(app).get('/genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns 200 and the genres that exist', async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama'), ('Comedy')")
        const res = await request(app).get('/genres')
        expect(res.status).toBe(200)
        // ids 1 and 2 are known because resetDb restarts the id counters.
        // The order is only guaranteed because the route uses ORDER BY id:
        // without ORDER BY, SQL doesn't promise any row order.
        expect(res.body).toEqual([{ id: 1, name: 'Drama' }, { id: 2, name: 'Comedy' }])
    })
})