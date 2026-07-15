# B1 — Node.js Basics

A plain Node.js HTTP server built with only the built-in `http` module — no Express,
no frameworks. Goal: understand the request/response cycle and event loop fundamentals
that frameworks normally hide.

## Covers
- `http.createServer()` and the request/response cycle
- Routing by `req.url` and `req.method`
- Reading a POST body via streams (`req.on('data')` / `req.on('end')`)
- Parsing JSON bodies with `JSON.parse()` + error handling
- Sending JSON responses with `JSON.stringify()`
- Query string parsing using the `URL` class
- The `res.writeHead()` single-call-per-response rule

## Run
```bash
npm start
```
Server runs on `http://localhost:3000`.

## Routes
| Method | Path | Description |
|---|---|---|
| GET | `/` | Home page |
| GET | `/about` | About page |
| GET | `/greet?name=X` | Greets by query param, or "stranger" if omitted |
| POST | `/echo` | Parses a JSON body, echoes back a greeting |