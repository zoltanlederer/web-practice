import { pool } from './db.js';
import express from 'express';
import type { Request, Response } from 'express';

const app = express()

app.get('/movies', (req: Request, res: Response) => {
    res.send('movies route works')
})

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})