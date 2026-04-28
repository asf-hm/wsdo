# Book Management API — Design Document

> Living document. Update this before making architectural changes.

---

## Status: In Design

---

## 1. Project Shape

```
src/
├── routes/          # HTTP surface only — register controllers, no logic
├── controllers/     # Parse req, call service, shape response + status code
├── services/        # Business rules: authz, feed ranking, CRUD logic
├── models/          # Mongoose schemas: User, Library, Book
├── middleware/       # JWT auth guard, input validation, async error handler
├── seed/            # Preload users, libraries, sample books on startup
└── app.ts           # Express app setup (no listen)
server.ts            # Entry point: connect Mongo, run seed, start server
```

---

## 2. Entities & Schemas

### Book
| Field | Type | Notes |
|---|---|---|
| `title` | string | required, non-empty |
| `author` | string | required, non-empty |
| `authorCountry` | string | **added** — required to implement feed country-priority rule (no Author entity exists) |
| `publishedDate` | Date | required |
| `pages` | number | required, > 0 |
| `library` | ObjectId ref Library | required |

> `authorCountry` is not in the assignment entity list but is necessary to satisfy the feed requirement "prioritize books by authors from the same country as the user." Documented here and in README.

### Library
| Field | Type | Notes |
|---|---|---|
| `name` | string | required |
| `location` | string | required |

### User
| Field | Type | Notes |
|---|---|---|
| `username` | string | required, unique |
| `password` | string | hashed, excluded from query projections |
| `country` | string | required — used for feed country-priority |
| `libraries` | ObjectId[] ref Library | required |
| `role` | `'admin' \| 'user'` | optional, default `'user'` |

---

## 3. Indexes

```ts
// Supports $match in feed pipeline and all book queries scoped by library
BookSchema.index({ library: 1 })
// Supports feed $match + sameCountry bucket split
BookSchema.index({ library: 1, authorCountry: 1 })
```

> The computed `score` sort (`$addFields` → `$sort`) cannot use an index — Mongo must sort the matched candidate set in memory. These indexes reduce the candidate set; they do not eliminate the sort cost. See §6 for scope notes.

Additional indexes for `/books` list queries (sorting/filtering by title, author) can be added once pagination and sort requirements are finalized.

---

## 4. Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| POST | `/login` | Validate credentials, return signed JWT |

### Protected (JWT required)
| Method | Path | Description |
|---|---|---|
| GET | `/books?page=1&limit=20` | Paginated list of books in user's libraries |
| POST | `/books` | Create book in a user-owned library |
| GET | `/books/:id` | Get single book (must be in user's libraries) |
| PUT | `/books/:id` | Update book (must be in user's libraries) |
| DELETE | `/books/:id` | Delete book (must be in user's libraries) |
| GET | `/feed` | Ranked book recommendations for the user |

### List Pagination
- `GET /books` supports `page` and `limit` query params
- Defaults: `page=1`, `limit=20`
- Maximum `limit`: `100`
- Response shape:
  ```json
  {
    "data": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
  ```
- Query remains scoped to `library: { $in: req.user.libraries }`

---

## 5. Access Control

- JWT decoded in auth middleware → `req.user` typed as `{ id, country, libraries, role }`
- Every book query scoped with `library: { $in: req.user.libraries }`
- **Create**: validate `body.library` is in `req.user.libraries` before writing
- **Update/Delete**: query filter must be `{ _id: id, library: { $in: req.user.libraries } }` — this ensures the user owns the book before touching it. If the document is not found, return 404 (not 403 — do not leak existence). Then, if `body.library` is being changed, separately validate that the new value is also in `req.user.libraries`.
- Admin role does **not** bypass library membership rules (assignment says "users can only…"; admin special-casing is not specified)

---

## 6. Feed Algorithm

### Rules (from assignment)
1. Books from user's libraries only
2. Books by authors from the same country as the user ranked first
3. Within each group: weighted score — **80% pages, 20% age** (older = higher)
4. Sort descending by priority then score

### Sorting model
Same-country is a **hard priority bucket**, not part of the numeric score. The sort is:
```
sameCountry desc → score desc
```
Country does not appear in the 80/20 formula — it only determines which bucket a book falls into. This matches the assignment's "prioritize… then rank by weighted score" phrasing exactly.

### Normalization
Raw `pages` (0–5000+) and raw age in years (0–100+) are on incompatible scales.
Without normalization, pages dominate the 80/20 split entirely.

**Strategy: fixed caps**
```
normalizedPages = min(pages, MAX_PAGES) / MAX_PAGES       // MAX_PAGES = 2000
normalizedAge   = min(ageInDays, MAX_AGE) / MAX_AGE       // MAX_AGE = 36500 (100 years)
score           = 0.8 * normalizedPages + 0.2 * normalizedAge
```
Constants are configurable via env vars. Documented in README.

### Pure scoring helper
Extract scoring into a testable pure function in `src/services/feedScore.ts`:
```ts
export function scoreBook(pages: number, ageInDays: number, opts: ScoreOptions): number {
  const normalizedPages = Math.min(pages, opts.maxPages) / opts.maxPages
  const normalizedAge   = Math.min(ageInDays, opts.maxAgeDays) / opts.maxAgeDays
  return 0.8 * normalizedPages + 0.2 * normalizedAge
}
```
The Mongo aggregation pipeline mirrors this formula exactly — same constants, same math. Tests validate `scoreBook` directly without mocking aggregation chains. The pipeline is a thin translation of the formula into Mongo syntax.

### Aggregation Pipeline (Mongo)
```
$match     → library: { $in: userLibraries }
$addFields → sameCountry: (authorCountry == userCountry) ? 1 : 0
           → ageInDays: dateDiff(now, publishedDate)
           → normalizedPages: min(pages, MAX_PAGES) / MAX_PAGES
           → normalizedAge: min(ageInDays, MAX_AGE) / MAX_AGE
           → score: 0.8 * normalizedPages + 0.2 * normalizedAge
$sort      → sameCountry: -1, score: -1
$limit     → default 50 (configurable via FEED_LIMIT env var)
$project   → strip internal score fields from response
```

> **Scalability scope**: The `$match` stage uses the `library` index to reduce the working set. However, the computed `score` sort still operates over all matched documents in memory — Mongo cannot index a derived field. For assignment purposes this is sufficient. Enable `allowDiskUse: true` on the aggregation to avoid in-memory sort limits. At production scale, consider precomputed ranking fields, per-library recommendation materialization, or bounded candidate selection (e.g. `$limit` after `$match`) before final scoring.

---

## 7. Authentication

- `POST /login` accepts `{ username, password }`
- Password stored hashed (bcrypt) — compared with `bcrypt.compare`
- On success: sign JWT with `{ id, username, country, libraries, role }` payload
- JWT secret from `JWT_SECRET` env var (min 32 chars)
- JWT expiry: `JWT_EXPIRES_IN` env var (default `'7d'`)
- Auth middleware: parse `Authorization: Bearer <token>`, verify, attach `req.user`, return `401` on any failure

**JWT payload tradeoff**: embedding `country` and `libraries` avoids a DB round-trip on every request (simpler, faster). The downside is that membership changes do not take effect until token expiry, and users with many libraries produce larger tokens. For this assignment this is acceptable. A cleaner production pattern is `{ id, username, role }` in the token only, with the auth middleware loading the current user from Mongo on each request.

---

## 8. Validation & Error Handling

- Input validation via **Zod** schemas in middleware (clean TypeScript-first approach)
- Centralized async error handler: catches thrown errors, maps to HTTP status
- In `production`: generic error messages only (no stack traces)
- Custom error classes: `AppError(message, statusCode)`

---

## 9. Seed Data

Loaded on startup. Seeding is **idempotent** — upsert by `username` for users, by `name` for libraries. Safe to run repeatedly or when only one collection exists.

- **2 Libraries**: e.g. `City Library (New York)`, `Central Library (London)`
- **2 Users**:
  - `{ username: "alice", country: "US", libraries: [lib1, lib2] }`
  - `{ username: "bob", country: "GB", libraries: [lib2] }`
- **Sample Books**: mix of `authorCountry` values (`US`, `GB`, `FR`), varied `pages` and `publishedDate` — enough to exercise feed ranking meaningfully (same-country priority and score ordering both visible in results)

Demo credentials are listed in README. Passwords stored as bcrypt hashes in DB.

---

## 10. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | yes | — | MongoDB connection string |
| `JWT_SECRET` | yes | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | no | `7d` | JWT expiry |
| `PORT` | no | `3000` | Server port |
| `NODE_ENV` | no | `development` | Controls error verbosity |
| `BOOKS_DEFAULT_LIMIT` | no | `20` | Default page size for `GET /books` |
| `BOOKS_MAX_LIMIT` | no | `100` | Maximum page size for `GET /books` |
| `FEED_LIMIT` | no | `50` | Max books returned by feed |
| `FEED_MAX_PAGES` | no | `2000` | Normalization cap for pages |
| `FEED_MAX_AGE_DAYS` | no | `36500` | Normalization cap for age |

---

## 11. Docker

- `Dockerfile`: multi-stage — `builder` (compile TS), `runner` (production node)
- `docker-compose.yml`: `app` service + `mongo` service
- Mongo connection string injected via `MONGO_URI` env var
- App does not run as root in container

---

## 12. Testing Strategy

Framework: **Mocha + Sinon**, HTTP assertions via **supertest**, assertions via **chai**.

Stub Mongoose model methods with Sinon — no live DB in tests.

Feed ranking logic tested at two levels:
- **`scoreBook()` unit tests**: validate scoring math directly — no Mongo involved.
- **Pipeline shape tests**: assert the aggregation array passed to `aggregate()` contains the expected stages (`$match`, `$addFields`, `$sort`, `$limit`, `$project`) in order. This verifies the pipeline is built correctly without needing a live DB.
- **Endpoint integration tests**: stub `Model.aggregate` to return a pre-ordered array; assert the controller returns it unchanged. This proves the controller does not re-sort or filter the aggregation result.

> Stubbing `aggregate` and checking response order only proves the controller returns what it was given — it does not test ranking. Keep ranking tests at the `scoreBook` + pipeline-shape level.

| Test | Scenario |
|---|---|
| `POST /books` | happy path — book created, 201 returned |
| `POST /books` | invalid input (pages ≤ 0, missing title) → 400 |
| `POST /books` | library not in user's membership → 403 |
| `POST /books` | missing JWT → 401 |
| `GET /books` | applies default pagination and scopes results to user's libraries |
| `GET /books` | clamps `limit` to configured maximum |
| `GET /books/:id` | happy path — returns book |
| `GET /books/:id` | book outside user's libraries → 404 |
| `scoreBook()` | higher pages → higher score |
| `scoreBook()` | higher age → higher score |
| `scoreBook()` | normalization caps prevent pages dominating |
| feed pipeline | pipeline contains `$match`, `$addFields`, `$sort`, `$limit`, `$project` stages in order |
| `GET /feed` | controller returns aggregation result unchanged (stub returns pre-ordered array) |
| feed pipeline | sort stage is `sameCountry: -1, score: -1` (same-country bucket first, then score desc) |
| `GET /feed` | no books in user's libraries → empty array |
| `GET /feed` | missing JWT → 401 |
| `POST /login` | valid credentials → JWT returned |
| `POST /login` | wrong password → 401 |

---

## 13. Open Questions

| # | Question | Decision |
|---|---|---|
| 1 | Should admin bypass library membership? | No — not specified, keep uniform rule |
| 2 | Pagination on `/books` list and `/feed`? | `$limit` with `FEED_LIMIT` for feed; simple skip/limit for books list with enforced default and max limit (e.g. default 20, max 100) |
| 3 | Should `authorCountry` be a free string or an enum? | Free string — simpler, no ISO code enforcement needed for this scope |

---

## 14. Decisions Log

| Date | Decision | Reason |
|---|---|---|
| 2026-04-28 | Add `authorCountry` to Book schema | No Author entity; required to implement feed country-priority rule |
| 2026-04-28 | Use fixed-cap normalization for feed scoring | Prevents pages from dominating 80/20 split due to scale mismatch |
| 2026-04-28 | Persist User and Library in MongoDB | Authorization depends on library membership; more coherent than in-memory |
| 2026-04-28 | Admin does not bypass library rules | Assignment states "users can only…" — no admin exception specified |
| 2026-04-28 | Extract pure `scoreBook` helper alongside aggregation pipeline | Decouples ranking logic from Mongo — makes unit tests trivial, pipeline becomes thin translation |
| 2026-04-28 | Seed is idempotent (upsert by username/library name) | Prevents duplicate data on repeated startups or partial collection state |
| 2026-04-28 | Same-country is a hard priority bucket, not part of the 80/20 formula | Matches assignment phrasing "prioritize… then rank by weighted score" — two distinct steps |
| 2026-04-28 | JWT embeds country + libraries (not DB lookup per request) | Acceptable for assignment scope; documented tradeoff: stale on membership change, larger tokens |
| 2026-04-28 | Update/delete uses `{ _id, library: $in }` filter, then validates new body.library separately | Prevents horizontal privilege escalation where user updates a book they can't see into a library they can |
| 2026-04-28 | Feed scalability claim softened; allowDiskUse added | Computed sort cannot use indexes — $match reduces candidate set but sort is still in-memory |
| 2026-04-28 | Feed tests split: scoreBook unit + pipeline shape + controller integration | Stubbing aggregate and checking order only proves controller passthrough, not ranking logic |
| 2026-04-28 | Removed library+pages and library+publishedDate indexes | Computed score sort cannot use field indexes; removed to avoid implying false optimization |
| 2026-04-28 | Add basic `GET /books?page&limit` pagination | Keeps list endpoint practical for large collections while staying simple for assignment scope |
