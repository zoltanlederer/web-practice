import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'

afterAll(async () => {
    await pool.end()
})

describe('GET /genres', () => {
    it('returns 200 and an empty array when there are no genres', async () => {
        const res = await request(app).get('/genres')
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })
})