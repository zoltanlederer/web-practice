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

describe('GET /genres', () => {
    it('returns 200 and an empty array when there are no genres', async () => {
        const res = await request(app).get('/genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns 200 and the genres that exist', async () => {
        await pool.query("INSERT INTO genres (name) VALUES ('Drama'), ('Comedy')")
        const res = await request(app).get('/genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([{ id: 1, name: 'Drama' }, { id: 2, name: 'Comedy' }])
    })
})