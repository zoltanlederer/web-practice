# D3 — React State & Routing

A small movie browser and watchlist built as a from-scratch practice drill:
multi-page routing with a shared layout, a `useReducer`-driven watchlist with
add/remove, validated form input, and a `useRef` focus example — rounding out
the React gaps left after C1/C2 (own repos, not in `web-practice`).

Part of the [web-practice](https://github.com/zoltanlederer/web-practice) repo.

## Tech stack

- React 19 + TypeScript
- Vite
- `react-router-dom` v7 (same version as Project 11's frontend)
- Static local data (`src/data/movies.json`) — no backend, no persistence

## Structure

```
src/
  components/
    Layout.tsx        # shared nav bar + <Outlet />
  pages/
    Home.tsx
    MovieList.tsx      # renders movies.json as links to /movies/:id
    MovieDetail.tsx     # useParams + derived lookup, falls back to NotFound
    NotFound.tsx
    Watchlist.tsx       # useReducer + validated form + useRef
  data/
    movies.json
  types.ts              # shared Movie type
  App.tsx               # route definitions
  main.tsx              # BrowserRouter + root render
```

## Routes

| Path | Page | Notes |
|---|---|---|
| `/` | Home | |
| `/movies` | Movie list | links to each movie's detail page |
| `/movies/:id` | Movie detail | reads `:id` via `useParams`, falls back to 404 if no match |
| `/watchlist` | Watchlist | add/remove movies, backed by `useReducer` |
| `*` | Not found | catch-all; nested inside the layout so the nav bar still shows |

## Notable implementation details

- **Layout route, not a wrapper component** — `<Route element={<Layout />}>`
  with no `path`, wrapping the other routes as children, with `<Outlet />`
  rendering whichever child matched. Keeps the nav bar out of every page
  component instead of importing/rendering it repeatedly.
- **404 nested inside the layout, not outside it** — a deliberate choice: a
  lost user still sees the nav bar and can navigate back out, rather than
  hitting a dead end.
- **`MovieDetail` uses a derived value, not `useEffect`/`useState`** — the
  matching movie is found with `.find()` directly during render; nothing here
  needs to be "synced" after the fact.
- **`useReducer` for the watchlist** — a pure reducer handles `add` and
  `remove` actions on the items array, rather than spreading that logic
  across multiple `setState` calls. The action shape is a TypeScript union
  type (`WatchlistAction`), so the reducer narrows correctly on `action.type`.
- **Form validation runs on submit, not live** — Title (required, non-blank)
  and Year (required, numeric, sane range) are checked before dispatching;
  Note is optional and unvalidated on purpose, to show not every field needs
  a check. `Number('')` evaluates to `0`, not `NaN`, so the empty-year case is
  checked explicitly rather than relying on `isNaN()` alone.
- **`useRef` auto-focuses the Title input on mount** — a `useEffect` with an
  empty dependency array calls `.focus()` on the input's DOM node once,
  right after the first render.

## What's not included (by design)

This is a practice project, scoped deliberately:
- No persistence — watchlist state lives only in the `Watchlist` component and
  resets on refresh or navigation away/back, since the component unmounts.
  Real persistence is D1's job (own database) and Project 12's (connecting it
  end to end).
- No real API — `movies.json` is static; `useEffect` + `fetch` was left out
  since C2 already covers that pattern.
- No `useContext` — left for Project 11/Project 12's larger scope.