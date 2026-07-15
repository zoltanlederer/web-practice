# B1.5 — Node.js Fundamentals

Small, separate exercises covering core Node concepts not touched in B1 — things
Express and other frameworks assume you already know.

## Covers
- **`01-modules.js` / `01-modules-helper.js`** — sharing code between files with
  `require` / `module.exports`, including destructuring imports
- **`02-async-await.js`** — Promises and `async`/`await`, wrapping a callback-based
  API (`setTimeout`) in a Promise, and error handling with `try/catch`
- **`03-fs.js`** — reading/writing files with `fs.promises`, Buffer vs string
  (encoding), and real file-operation error handling
- **`04-env-vars.js`** — loading environment variables from a `.env` file with
  `dotenv`, and the `.env` / `.env.example` pattern for keeping secrets out of Git

## Setup
```bash
npm install
```

## Run
```bash
node 01-modules.js
node 02-async-await.js
node 03-fs.js
node 04-env-vars.js
```

## Notes
- `.env` is gitignored — see `.env.example` for the variables `04-env-vars.js` expects.