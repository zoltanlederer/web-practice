import { pool } from './db.js'
import express from 'express'
import type { Request, Response } from 'express'

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

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})