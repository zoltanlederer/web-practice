# D1 — Own Database

A small Express + PostgreSQL API for tracking movies and their genres, built as a
from-scratch practice drill: designing a schema, connecting Node to Postgres, and
implementing full CRUD — including a many-to-many relationship, transactions, and
JOIN-based queries.

Part of the [web-practice](https://github.com/zoltanlederer/web-practice) repo.

## Tech stack

- Node.js + TypeScript (ESM)
- Express
- PostgreSQL, via the `pg` driver (no ORM — raw SQL throughout, by design)
- `dotenv` for environment config

## Schema

Three tables, modeling a many-to-many relationship between movies and genres:

```sql
CREATE TABLE genres (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE movies (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    year INT CHECK (year > 1880),
    rating NUMERIC(3, 1),
    watched BOOLEAN DEFAULT false
);

CREATE TABLE movie_genres (
    movie_id INT REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INT REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);
```

`movie_genres` is the join table linking movies to genres — a composite primary key
(`movie_id`, `genre_id`) prevents duplicate pairings, and `ON DELETE CASCADE` cleans up
genre links automatically when a movie or genre is deleted.

## Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/movies` | List all movies, each with its genres |
| GET | `/movies/:id` | Get one movie, with its genres |
| POST | `/movies` | Create a movie; optionally attach genres via `genre_ids` |
| PUT | `/movies/:id` | Replace a movie (all fields required); replaces genres if `genre_ids` sent |
| PATCH | `/movies/:id` | Partially update a movie (any subset of fields); replaces genres if `genre_ids` sent |
| DELETE | `/movies/:id` | Delete a movie |
| GET | `/genres` | List all genres |

### Request/response examples

**Create a movie with genres:**
```bash
curl -X POST http://localhost:3000/movies \
  -H "Content-Type: application/json" \
  -d '{"title": "Doctor Strange", "year": 2016, "rating": 7.5, "watched": true, "genre_ids": [1, 6]}'
```

**Partially update just one field:**
```bash
curl -X PATCH http://localhost:3000/movies/3 \
  -H "Content-Type: application/json" \
  -d '{"watched": false}'
```

**Response shape (`GET /movies/:id`):**
```json
{
  "id": 3,
  "title": "Doctor Strange",
  "year": 2016,
  "rating": "7.5",
  "watched": true,
  "genres": ["action", "fantasy"]
}
```

## Notable implementation details

- **Transactions** — `POST`, `PUT`, and `PATCH` wrap their writes in
  `BEGIN`/`COMMIT`/`ROLLBACK` whenever genres are involved, so a movie is never left
  half-created if a genre link fails to insert.
- **Dynamic `SET` clause** — `PATCH` builds its `UPDATE` statement from only the
  fields actually present in the request body, instead of requiring the full object.
- **Genre replacement, not merging** — sending `genre_ids` on `PUT`/`PATCH` replaces
  the movie's full set of genres (delete existing links, insert the new set), so
  genres can be removed as well as added.
- **`try/finally` connection cleanup** — every route releases its pooled client back
  to the pool in a `finally` block, so a failed query never leaks a connection.
- **JOIN + aggregation for reads** — `GET /movies` and `GET /movies/:id` use a
  `LEFT JOIN` (so genre-less movies still appear) combined with
  `array_agg(...) FILTER (...)` and `COALESCE(..., '{}')` to return genres as a clean
  array rather than duplicate rows per genre.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file (see `.env.example` for the required keys):
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=d1_movies
   DB_USER=your_username
   ```

3. Create the database and run the schema above:
   ```bash
   createdb d1_movies
   psql -d d1_movies
   ```
   Then paste in the three `CREATE TABLE` statements.

4. Seed a few starter genres (movies reference these via `genre_ids`):
   ```sql
   INSERT INTO genres(name) VALUES
       ('action'), ('adventure'), ('comedy'),
       ('crime'), ('documentary'), ('fantasy');
   ```

5. Build and run:
   ```bash
   npm run build
   npm run dev
   ```
   Server starts on `http://localhost:3000` (or the port set in `.env`).

## What's not included (by design)

This is a practice project, scoped deliberately:
- No authentication — planned as a separate practice drill (D2), to be layered on
  top of this database
- No automated tests yet — planned for D4 (Jest + Supertest)
- No frontend — API only