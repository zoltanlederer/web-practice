import 'dotenv/config'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET
if (!secret) {
    throw new Error('JWT_SECRET is missing from .env')
}
// After the check, secret is narrowed to string, so this assignment is allowed,
// and JWT_SECRET is a plain string everywhere: in this file and in every file that imports it.
export const JWT_SECRET: string = secret

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization

    // Expected format: "Bearer <token>". Reject anything else before even
    // attempting to verify, so a missing/malformed header fails fast.
    if (!authHeader || !authHeader.startsWith('Bearer ')){
        res.status(401).json({ error: 'authorization error' })
        return
    }

    const token = authHeader.slice(7) // strip the "Bearer " prefix (7 chars)

    try {
        // Throws if the signature is invalid or the token has expired.
        const decoded = jwt.verify(token, JWT_SECRET)

        // jwt.verify's return type is `string | JwtPayload` — a generic shape that
        // doesn't know about our custom `id` field. Narrow it manually before trusting it.
        if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'number' ) {
           res.status(401).json({ error: 'invalid token payload' })
           return
        }
        req.user = { id: decoded.id }
        next()
    } catch {
        res.status(401).json({ error: 'invalid or expired token' })
        return
    }
}