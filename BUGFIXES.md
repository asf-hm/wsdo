# Bugfix Triage

This file separates actual bugs from production-hardening suggestions and test/style polish.

---

## Resolved Correctness Fixes

### JWT payload validation

Previous risk: `jwt.verify()` returns unknown runtime data, but the middleware cast it directly to `AuthUser`.

Why it matters: a validly signed but malformed token could inject unexpected `libraries`, `country`, or `role` values into `req.user`.

Status: **fixed**. The decoded payload is validated with `authPayloadSchema` before assigning `req.user`.

Files:
- `src/validators/common.ts`
- `src/validators/authPayload.validator.ts`
- `src/middleware/auth.ts`

---

### Feed aggregation ObjectId casting

Previous risk: the feed pipeline used:

```ts
{ $match: { library: { $in: user.libraries } } }
```

Why it matters: Mongoose does not reliably cast values inside aggregation pipelines. If `library` is stored as an ObjectId and `user.libraries` contains strings, `/feed` may return an empty array even when matching books exist.

Status: **fixed**. User library IDs are cast with `new Types.ObjectId(id)` before building the aggregation `$match`.

File:
- `src/services/feed.service.ts`

---

### Update library check

Previous code checked:

```ts
if (input.library) {
  assertLibraryMembership(user, input.library);
}
```

Status: **fixed**.

File:
- `src/services/book.service.ts`

---

### Seed data idempotency

Previous risk: books were seeded only when `estimatedDocumentCount()` was zero.

Why it matters: this is fragile if seed state is partial. It can also be racy in concurrent startup scenarios.

Status: **fixed**. Sample books are now upserted by title.

File:
- `src/seed/seedData.ts`

Note: rehashing demo passwords on every restart is not functionally wrong, so it remains acceptable for assignment scope.

---

## Open Correctness / Maintainability Items

### Controller double-casts validated query params

Current risk:

```ts
req.query as unknown as { page: number; limit: number }
```

Why it matters: validation transforms query values, but the double cast hides mistakes from TypeScript and makes controller/service boundaries less trustworthy.

Status: **open, optional**. The runtime behavior is currently covered by validation and tests. A cleaner fix would store validated data on a typed request property or introduce a typed request helper.

---

## Robustness Improvements

### CORS configuration

Current behavior: `cors()` allows all origins.

Why it matters: this is usually acceptable for a backend assignment, but production/browser deployments should restrict allowed origins.

Fix: optionally add an `ALLOWED_ORIGINS` env var. Keep it simple if implemented.

Status: **open, optional**.

---

## Overstated / Not Actual Bugs

### `schema.parse()` throws synchronously in validation middleware

Not an actual Express 4 bug. Express catches synchronous throws from middleware and forwards them to the error handler. Since the error handler maps `ZodError` to `400`, validation failures should not crash the app.

Still, `safeParse()` or `try/catch next(error)` can make the intent clearer.

---

### Defensive `requireId()` helper

Not a bug. The check is redundant after route validation, but harmless.

---

### Missing database connection event handlers

Not a functional bug for this assignment. Useful production hardening.

---

### Express type augmentation via side-effect import

Not a runtime bug. A `.d.ts` file is cleaner TypeScript hygiene, but the current approach works.

---

## Test / Style Polish

- Pipeline shape test could assert deeper expressions, not just stage order.
- Sinon stubs currently use `as never`; acceptable for assignment tests, but not ideal.
- `scoreBook()` and the aggregation math can drift; a consistency test or shared constants helps.

---

## Current Recommended Fix Set

The meaningful correctness fixes have been applied:

```txt
1. Validate decoded JWT payload - done
2. Cast feed library IDs to ObjectId - done
3. Use input.library !== undefined in update logic - done
4. Improve seed book idempotency - done
```

Remaining optional work:

```txt
1. Remove req.query double cast with a typed validation result pattern
2. Add simple CORS env config if desired
3. Tighten test internals / reduce casts in stubs
```
