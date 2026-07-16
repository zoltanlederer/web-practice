# B1.6 — Node.js Project Structure

A small capstone combining everything from B1 and B1.5 into a more realistic project
layout — same server as B1, but split across files and configured via environment
variables.

## Covers
- Splitting route logic into its own module (`routes.js`), imported into `server.js`
  via `require`/`module.exports`
- Reading the port from a `.env` file instead of hardcoding it

## Setup
```bash
npm install
```

## Run
```bash
npm start
```
Server runs on the port set in `.env` (see `.env.example`).

## Routes
| Method | Path | Description |
|---|---|---|
| GET | `/` | Home page |
| GET | `/about` | About page |
| GET | `/greet?name=X` | Greets by query param, or "stranger" if omitted |
| POST | `/echo` | Parses a JSON body, echoes back a greeting |