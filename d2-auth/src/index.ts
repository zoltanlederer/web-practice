import { pool } from './db.js'
import express from 'express'
import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

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

app.post('/login', async (req: Request, res: Response) => {
    let client
    try {
        const { email, password } = req.body
        if (!email) {
            res.status(400).json({ error: 'email is required' })
            return
        }
        if (!password) {
            res.status(400).json({ error: 'password is required' })
            return
        }
        
        client = await pool.connect()
        
        const result = await client.query(`SELECT id, password_hash FROM users WHERE email = $1`, [email])
        const user = result.rows[0]

        // Same error message and status for "no such user" and "wrong password" (below) —
        // a different message per case would let an attacker discover which emails are registered.
        if (!user) {
            res.status(401).json({ error: 'email or password is wrong' })
            return
        }

        const passwordCheck = await bcrypt.compare(password, user.password_hash)

        if (!passwordCheck) {
            res.status(401).json({ error: 'email or password is wrong' })
            return
        }

        // Payload holds only the user id — enough to identify them on future requests,
        // without exposing or baking in anything sensitive (the token itself isn't encrypted,
        // just signed, so anyone with it can read this payload).
        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        )

        res.json({ token })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'login failed' })
    } finally {
        client?.release()
    }
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})