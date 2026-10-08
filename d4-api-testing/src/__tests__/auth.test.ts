import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.js'

beforeEach(async () => {
    await resetDb()
})

afterAll(async () => {
    await pool.end()
})

describe('POST /register', () => {
    it('returns 409 when the email is already registered', async () => {
        await pool.query("INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'not-a-real-hash')")

        const res = await request(app)
            .post('/register')
            .send({email: 'test@example.com', password: 'password123'})
        
        const result = await pool.query('SELECT * FROM users')
        expect(res.status).toBe(409)
        expect(res.body).toHaveProperty('error')
        expect(result.rows).toHaveLength(1)
    })
})

describe('POST /login', () => {
    it('returns 401 and no token for a wrong password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const res = await request(app)
            .post('/login')
            .send({email: 'test@example.com', password: 'wrong-password'})
        
        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(res.body).not.toHaveProperty('token')
    })

    it('returns 200 and a valid token for the correct password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const res = await request(app)
            .post('/login')
            .send({email: 'test@example.com', password: 'correct-password'})
        
        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('token')
        // jwt.verify throws if the signature is wrong, so the test would fail right here
        const decoded = jwt.verify(res.body.token, JWT_SECRET)
        expect(decoded).toHaveProperty('id', 1)
        expect(decoded).toHaveProperty('exp')
    })

    it('returns 401 and the same error for an unknown email as for a wrong password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const wrongPassword = await request(app)
            .post('/login')
            .send({email: 'test@example.com', password: 'wrong-password'})

        const unknownEmail = await request(app)
            .post('/login')
            .send({email: 'unknown@example.com', password: 'wrong-password'})
        
        expect(wrongPassword.status).toBe(401)
        expect(unknownEmail.status).toBe(401)
        expect(wrongPassword.body).toHaveProperty('error')
        expect(wrongPassword.body).toEqual(unknownEmail.body)
    })
})
