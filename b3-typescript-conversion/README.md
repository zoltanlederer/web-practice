# B3 — TypeScript Fundamentals

Practice module: TypeScript conversion of the B2 Express API. Goal was to learn
TypeScript's type system on top of already-familiar code — same routes, same
behavior, no new functionality. The only thing that changed is that everything
now has explicit types, and the code passes through the TypeScript compiler
(`tsc`) before running.

## What this covers

- **Project setup** — `tsc`, `tsconfig.json`, `@types/express`, `@types/node`
- **Typing route/middleware parameters** — `Request`, `Response`, `NextFunction`
  on every route and middleware, `Error` on the error-handling middleware
- **Interfaces** — `Item` describes the shape of a single item; array-ness added
  separately at the point of use (`Item[]`)
- **Optional properties** — `ItemUpdate` (`name?: string`) for partial
  `PATCH` bodies
- **`any` and why it's a trap** — turns off type-checking entirely, defeats the
  point of using TypeScript
- **ES Modules vs CommonJS** — `import`/`export` syntax requires
  `"type": "module"` in `package.json`; without it, TypeScript assumes the
  older CommonJS (`require`) system by default
- **Type-only imports** — `Request`/`Response`/`NextFunction` don't exist at
  runtime, so `verbatimModuleSyntax` requires importing them with `import type`
- **Typing `req.body` with generics** — `Request<Params, ResBody, ReqBody>`,
  used to type `req.body` as `NewItemBody` on `POST /items` and `ItemUpdate` on
  `PATCH /items/:id`. Compile-time only — doesn't validate what a client
  actually sends, so the manual checks (`typeof body.name !== 'string'`) are
  still required
- **Two TypeScript quirks** hit while doing that — spread merges silently
  making a required field "optional" in the result, and strict array-index
  settings (`noUncheckedIndexedAccess`) treating `items[index]` as possibly
  `undefined` even after an earlier check

## Routes

Same as B2, now fully typed:

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
npx tsc          # compiles server.ts -> server.js, reports any type errors
node server.js
```

Server runs on `http://localhost:3000`.

## Try it

```bash
# GET / — basic hello route
curl http://localhost:3000/

# POST / — echoes a name from the request body
curl -X POST http://localhost:3000/ -H "Content-Type: application/json" -d '{"name": "Zoli"}'

# GET /items — full list
curl http://localhost:3000/items

# GET /items?name= — filtered by query
curl "http://localhost:3000/items?name=banana"

# GET /items/:id — single item
curl http://localhost:3000/items/2

# POST /items — creates a new item
curl -X POST http://localhost:3000/items -H "Content-Type: application/json" -d '{"name": "date"}'

# PATCH /items/:id — partial update
curl -X PATCH http://localhost:3000/items/1 -H "Content-Type: application/json" -d '{"name": "green apple"}'

# DELETE /items/:id
curl -X DELETE http://localhost:3000/items/3

# GET /broken — triggers next(err) -> error middleware
curl http://localhost:3000/broken

# unmatched route — triggers the 404 catch-all
curl http://localhost:3000/nonexistent
```

Run one at a time — pasting several lines at once (especially with `#`
comments) can confuse `zsh`. `POST`/`DELETE` change the in-memory `items`
array, so order matters somewhat.