# D2 — Authentication

A JWT-based authentication API built as a from-scratch practice drill: user
registration, login, password hashing, and route protection with middleware —
layered on top of the database patterns from [D1](../d1-own-database).

Part of the [web-practice](https://github.com/zoltanlederer/web-practice) repo.

## Tech stack

- Node.js + TypeScript (ESM)
- Express
- PostgreSQL, via the `pg` driver (no ORM — raw SQL throughout, by design)
- `bcrypt` for password hashing
- `jsonwebtoken` for signing and verifying JWTs
- `dotenv` for environment config
- `tsx` for the dev server (see note below on why not `ts-node-dev`)

## Schema

```sql
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Endpoints

| Method | Route | Auth required | Description |
|---|---|---|---|
| POST | `/register` | No | Create a new user; hashes the password with bcrypt |
| POST | `/login` | No | Verify credentials, return a JWT valid for 1 hour |
| GET | `/me` | Yes | Return the logged-in user's own `email` and `created_at` |
| GET | `/` | Yes | Test route confirming the DB connection works |

### Request/response examples

**Register:**
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test1234"}'
```
```json
{ "email": "test@test.com", "created_at": "2026-09-16T20:56:07.709Z" }
```

**Login:**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test1234"}'
```
```json
{ "token": "eyJhbGciOiJIUzI1NiIs..." }
```

**Accessing a protected route:**
```bash
curl http://localhost:3000/me -H "Authorization: Bearer <token>"
```
```json
{ "email": "test@test.com", "created_at": "2026-09-16T20:56:07.709Z" }
```

## Notable implementation details

- **Passwords are never stored or returned in plain text** — only the bcrypt
  hash is persisted, and `RETURNING` clauses explicitly list columns to keep
  `password_hash` out of every API response.
- **No user enumeration** — `/login` returns the same status (`401`) and
  message for both "no such email" and "wrong password", so a client can't
  discover which emails are registered by probing the endpoint.
- **JWT payload is minimal** — only `{ id }` is signed into the token. JWTs are
  signed, not encrypted, so anything in the payload is readable by anyone
  holding the token; nothing sensitive goes in it.
- **Auth middleware (`requireAuth`)** — verifies the `Authorization: Bearer
  <token>` header, and on success attaches the decoded payload to `req.user`
  (via TypeScript module augmentation, `src/types/express.d.ts`) so downstream
  routes can identify the requester without trusting anything the client sent
  in the request body.
- **Fail-fast startup check** — the app throws immediately on boot if
  `JWT_SECRET` is missing from `.env`, rather than issuing broken tokens
  silently.
- **`tsx` instead of `ts-node-dev`** — `ts-node-dev` (via `ts-node`) is
  incompatible with both TypeScript 7's new Go-based compiler and native ESM;
  `tsx` (esbuild-based) handles both correctly and needs no changes when the
  TypeScript version changes.

## Setup

1. Install dependencies:
```bash
   npm install
```

2. Create a `.env` file (see `.env.example` for the required keys):
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=d2_auth
DB_USER=your_username
JWT_SECRET=your_secret_here
```

3. Create the database and run the schema:
```bash
   createdb d2_auth
   psql -d d2_auth
```
   Then inside the `psql` session:
```sql
   \i schema.sql
```

4. Run in dev mode:
```bash
   npm run dev
```
   Server starts on `http://localhost:3000` (or the port set in `.env`).

## What's not included (by design)

This is a practice project, scoped deliberately:
- No refresh tokens — the JWT simply expires after 1 hour; re-login is required
- No password reset flow
- No rate limiting on `/login` (a real deployment should add this against
  brute-force attempts)
- No automated tests yet — planned for D4 (Jest + Supertest)