import request from 'supertest'
import { pool } from '../db.js'
import { app } from '../app.js'
import { resetDb } from '../test-helpers.js'
import bcrypt from 'bcrypt'
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

describe('POST /register', () => {
    it('returns 409 when the email is already registered', async () => {
        // The user is inserted directly, so this test doesn't depend on /register working first.
        // Any text works as the hash: /register only checks that the email exists, it never reads the hash.
        await pool.query("INSERT INTO users (email, password_hash) VALUES ('test@example.com', 'not-a-real-hash')")

        const res = await request(app)
            .post('/register')
            .send({ email: 'test@example.com', password: 'password123' })

        const result = await pool.query('SELECT * FROM users')
        expect(res.status).toBe(409)
        expect(res.body).toHaveProperty('error')
        // toHaveLength instead of toEqual: the row has a created_at timestamp that can't be predicted.
        expect(result.rows).toHaveLength(1)
    })

    it('returns 201 and creates the user without exposing the password hash', async () => {
        const res = await request(app)
            .post('/register')
            .send({ email: 'test@example.com', password: 'password123' })

        const result = await pool.query('SELECT * FROM users')
        expect(res.status).toBe(201)
        expect(res.body.email).toBe('test@example.com')
        expect(res.body).toHaveProperty('created_at')
        expect(res.body).not.toHaveProperty('password_hash')
        expect(result.rows).toHaveLength(1)

        // Only safe once we know the row exists.
        // bcrypt.compare proves two things at once: the password wasn't stored as
        // plain text, and the stored value really is a hash of that password.
        const isMatch = await bcrypt.compare('password123', result.rows[0].password_hash)
        expect(isMatch).toBe(true)
    })
})

describe('POST /login', () => {
    // These tests need a REAL bcrypt hash, because /login runs bcrypt.compare against it.

    it('returns 401 and no token for a wrong password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const res = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'wrong-password' })

        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        // The key security promise: a failed login must never hand out a token.
        expect(res.body).not.toHaveProperty('token')
    })

    it('returns 200 and a valid token for the correct password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const res = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'correct-password' })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('token')
        // The exact token can't be predicted (iat and exp depend on the current time),
        // so instead of comparing it, verify it with the real secret and check its content.
        // jwt.verify throws if the signature is wrong, so the test would fail right here
        const decoded = jwt.verify(res.body.token, JWT_SECRET)
        expect(decoded).toHaveProperty('id', 1)
        // A token without exp would be valid forever.
        expect(decoded).toHaveProperty('exp')
    })

    it('returns 401 and the same error for an unknown email as for a wrong password', async () => {
        const password_hash = await bcrypt.hash('correct-password', 10)
        await pool.query('INSERT INTO users(email, password_hash) VALUES($1, $2)', ['test@example.com', password_hash])

        const wrongPassword = await request(app)
            .post('/login')
            .send({ email: 'test@example.com', password: 'wrong-password' })

        const unknownEmail = await request(app)
            .post('/login')
            .send({ email: 'unknown@example.com', password: 'wrong-password' })

        expect(wrongPassword.status).toBe(401)
        expect(unknownEmail.status).toBe(401)
        // Without this, two empty bodies ({} and {}) would also count as "the same".
        expect(wrongPassword.body).toHaveProperty('error')
        // Comparing two responses is right here, because sameness IS the requirement:
        // different messages would let an attacker find out which emails are registered.
        expect(wrongPassword.body).toEqual(unknownEmail.body)
    })
})