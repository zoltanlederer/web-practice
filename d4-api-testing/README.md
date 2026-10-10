# D4 — API Testing

Automated tests for a Node.js / Express / TypeScript API backed by PostgreSQL, written with **Jest** and **Supertest**.

The API combines the movie CRUD routes from D1 with the JWT authentication from D2. One route, `DELETE /movies/:id`, is protected by auth. The goal of this drill was to replace manual `curl` checks with a repeatable test suite that runs against a real, separate test database.

**27 tests** across 3 files, covering happy paths, error paths, transaction rollbacks and auth.

## Tech stack

- Node.js, Express 5, TypeScript
- PostgreSQL (`pg`)
- Auth: `bcrypt` (password hashing), `jsonwebtoken` (JWT)
- Testing: Jest 30, Supertest, Babel 7 (`@babel/preset-typescript`)

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/movies` | – | All movies with their genre names |
| GET | `/movies/:id` | – | One movie with its genre names |
| POST | `/movies` | – | Create a movie (optional `genre_ids`) |
| PUT | `/movies/:id` | – | Replace all fields (optional `genre_ids` replaces the links) |
| PATCH | `/movies/:id` | – | Update only the fields sent |
| DELETE | `/movies/:id` | **JWT** | Delete a movie (its genre links are removed by `ON DELETE CASCADE`) |
| GET | `/genres` | – | All genres |
| POST | `/register` | – | Create a user (password stored as a bcrypt hash) |
| POST | `/login` | – | Returns a JWT valid for 1 hour |

## What's tested

| File | Endpoint | Tests |
|---|---|---|
| `genres.test.ts` | `GET /genres` | empty list, existing genres in order |
| `movies.test.ts` | `GET /movies` | empty list, movies with genre names (sorted), movie with no genres → `[]` |
| | `GET /movies/:id` | found, 404, id not a number → 400, id not a whole number → 400 |
| | `POST /movies` | created (response **and** database checked), missing title → 400, nonexistent genre id → 400 with full rollback |
| | `PUT /movies/:id` | all fields replaced, genre links replaced, 404, nonexistent genre id → 400 with full rollback |
| | `PATCH /movies/:id` | only the sent fields change, nonexistent genre id → 400 with full rollback |
| | `DELETE /movies/:id` | no token → 401, forged token → 401, valid token → deleted (incl. cascade), valid token + missing movie → 404 |
| `auth.test.ts` | `POST /register` | success (no hash in the response, real bcrypt hash stored), duplicate email → 409 |
| | `POST /login` | correct password → verified JWT, wrong password → 401 and no token, same error for unknown email and wrong password |

Every error test that could change data also checks the database afterwards. A 400 or 401 is only half the promise; the other half is that nothing was written.

## Bugs found by the tests

Writing the tests uncovered five real bugs in the API, each fixed with a failing test first (red → green):

1. **`GET /genres`** had no `ORDER BY`, so the order wasn't guaranteed.
2. **`GET /movies`** had no `ORDER BY`, same problem.
3. **Genre names inside each movie** (`array_agg`) had no order either.
4. **A non-integer id** like `/movies/1.5` returned **500** instead of 400, because `isNaN(1.5)` is false. Fixed with `Number.isInteger` in all four `:id` routes.
5. **A nonexistent genre id** in `genre_ids` returned **500** instead of 400 in POST, PUT and PATCH. Fixed by handling Postgres error `23503` (foreign key violation) as a client error.

## Setup

### Prerequisites

- Node.js
- PostgreSQL running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create the two databases

The dev server and the tests use **separate databases**, because the tests empty every table before each test.

```bash
createdb d4_movies
createdb d4_movies_test
psql -d d4_movies -f schema.sql
psql -d d4_movies_test -f schema.sql
```

### 3. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=d4_movies
TEST_DB_NAME=d4_movies_test
DB_USER=your_username
JWT_SECRET=change_me
```

`JWT_SECRET` should be a long random string. The app refuses to start if it's missing.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the API from source with `tsx`, reloading on changes |
| `npm test` | Runs all tests against the test database |
| `npx tsc --noEmit` | Type-checks the whole project (Jest doesn't check types) |
| `npm run build` / `npm start` | Compiles to `dist/` and runs the compiled output |

## How the tests work

- **Database switch:** Jest sets `NODE_ENV=test` automatically. `src/db.ts` then connects to `TEST_DB_NAME` instead of `DB_NAME`, and throws if the chosen name is missing.
- **Clean state:** `resetDb()` in `src/test-helpers.ts` runs before every test. It first asks Postgres which database it is connected to (`SELECT current_database()`) and refuses to continue unless it's the test database. Then it runs `TRUNCATE ... RESTART IDENTITY CASCADE`, so every test starts empty with ids beginning at 1.
- **Serial runs:** `jest --runInBand` runs the test files one after another, because they all share one test database.
- **No running server needed:** `src/app.ts` builds and exports the Express app; `src/index.ts` only calls `listen()`. Supertest receives the `app` object directly.
- **Closing the pool:** each test file calls `pool.end()` in `afterAll`, otherwise the open database connections keep Jest from exiting.
- **Tokens in tests:** the DELETE tests sign tokens directly with `jwt.sign` instead of going through `/login`, so they only depend on the route and `requireAuth`. Login is tested separately in `auth.test.ts`.
- **Expected values are written by hand**, never copied from the code under test.

## Toolchain notes

- **TypeScript 7 + Jest:** `ts-jest` doesn't support TypeScript 7 without workarounds, so Jest uses `babel-jest` with `@babel/preset-typescript`, which only strips types. Type checking is done separately with `tsc --noEmit`.
- **Babel is pinned to version 7**, because Jest 30 doesn't support Babel 8 yet.
- **`.js` endings in imports:** the source uses Node's ES module style (`import ... from './db.js'` for `db.ts`). `moduleNameMapper` in `jest.config.cjs` strips the `.js` so Jest can find the `.ts` files.
- **Config files use `.cjs`** because `package.json` has `"type": "module"`.

## Project structure

```
d4-api-testing/
├── src/
│   ├── __tests__/
│   │   ├── auth.test.ts
│   │   ├── genres.test.ts
│   │   └── movies.test.ts
│   ├── types/
│   │   └── express.d.ts    # adds req.user to Express's Request type
│   ├── app.ts              # builds and exports the Express app (all routes)
│   ├── auth.ts             # JWT_SECRET check + requireAuth middleware
│   ├── db.ts               # pg pool, picks the dev or test database
│   ├── index.ts            # starts the server
│   └── test-helpers.ts     # resetDb() with the test-database safety check
├── babel.config.cjs
├── jest.config.cjs
├── schema.sql
└── tsconfig.json
```

## Not covered

The suite focuses on the main behaviors of each route. These cases are not tested:

- `PUT`: missing `title`; invalid ids for `PUT`, `PATCH` and `DELETE` (only `GET /movies/:id` tests them)
- `PATCH`: 404, "no fields provided", and a request with only `genre_ids`
- `/register`: password shorter than 8 characters; `/login`: missing fields
- `requireAuth`: expired tokens, and validly signed tokens with an unexpected payload
- Error messages are slightly inconsistent between routes (e.g. `'Invalid id'` vs `'invalid id'`), which is why the tests check for an `error` property rather than exact wording
- Login timing: an unknown email returns faster than a wrong password (no `bcrypt.compare`), which could in theory reveal registered emails