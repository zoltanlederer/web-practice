# B2 — Express Fundamentals

Practice module: Express basics, building on B1 (plain Node `http` server).
Goal was to understand what Express does *under the hood* — not just use it,
but see how it relates to the raw `http` module from B1.

## What this covers

- **Routing** — `GET`, `POST`, `PATCH`, `DELETE` on an in-memory `items` array
  (no database yet — that's intentionally out of scope here)
- **Middleware chain** — `express.json()` for body parsing, plus custom
  middleware; the `next()` mechanism that passes a request along the chain
- **Two `app.use()` shapes** — global (`app.use(fn)`, runs on every request)
  vs. path-scoped (`app.use('/items', fn)`, runs only for matching paths)
- **Request data sources** — `req.body` (JSON body), `req.params` (URL path
  segments, e.g. `/items/:id`), `req.query` (query string, e.g. `?name=`)
- **Status codes** — `200`, `201`, `400`, `404`, `500` used appropriately
- **Input validation** — reject malformed requests (missing/wrong-type
  fields) before acting on them, instead of trusting client input
- **Error handling** — a dedicated error-handling middleware
  (`(err, req, res, next)`, 4 parameters), and the distinction between
  `next()` (normal chain) vs `next(err)` (jumps to the error-handling chain,
  skipping regular middleware in between)
- **Catch-all 404** — for any request that doesn't match a defined route

## Routes

| Method | Path         | Description                                  |
|--------|--------------|-----------------------------------------------|
| GET    | `/`          | Basic hello route                             |
| POST   | `/`          | Echoes a name from the request body           |
| GET    | `/items`     | Returns all items, or filtered by `?name=`    |
| GET    | `/items/:id` | Returns one item by id                        |
| POST   | `/items`     | Creates a new item (validates `name`)         |
| PATCH  | `/items/:id` | Partially updates an item (validates `name`)  |
| DELETE | `/items/:id` | Deletes an item                               |
| GET    | `/broken`    | Deliberately throws, to test error handling   |

## Run it

```bash
npm install
node server.js
```

Server runs on `http://localhost:3000`.
