import { pool } from './db.js'
import express from 'express'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'

const app = express()
app.use(express.json())

app.get('/', async (req: Request, res: Response) => {
    let client
    try {
        client = await pool.connect()
        const result = await client.query('SELECT NOW()')
        res.json(result.rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to connect' })
    } finally {
        client?.release()
    }
})

app.post('/register', async (req: Request, res: Response) => {
    let client
    try {
        const { email, password } = req.body

        // Validate separately so the client gets a specific, actionable message
        // instead of one generic "bad request" for either missing field.
        if (!email) {
            res.status(400).json({ error: 'email is required' })
            return
        }
        if (!password) {
            res.status(400).json({ error: 'password is required' })
            return
        }

        // Never store the plain password — only the bcrypt hash.
        // saltRounds controls how expensive the hash is to compute (higher = slower = harder to brute-force).
        const saltRounds = 10
        const password_hash = await bcrypt.hash(password, saltRounds)

        client = await pool.connect()

        // RETURNING only email and created_at — never send password_hash back to the client.
        const result = await client.query(
            'INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING email, created_at',
            [email, password_hash]
        )
        res.status(201).json(result.rows[0])
    } catch (err) {
        console.error(err)

        // '23505' is Postgres's code for a unique constraint violation —
        // here specifically, a duplicate email. Give a clear, correct status (409)
        // instead of lumping it in with real server errors (500).
        if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
            res.status(409).json({ error: 'email already registered' })
        } else {
            res.status(500).json({ error: 'Failed to register' })
        }
    } finally {
        client?.release()
    }
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})