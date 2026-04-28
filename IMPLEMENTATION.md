# Implementation Notes

Use this as the practical build checklist for the assignment. Keep the code small, readable, and easy to review.

---

## 1. Build Only What Was Asked

- Full CRUD only for `Book`
- No CRUD endpoints for `User` or `Library`
- Seed users, libraries, and books automatically
- Do not add refresh tokens, admin panels, permissions UI, queues, caching, or other platform features

---

## 2. Keep Architecture Clean And Simple

Use the straightforward flow:

```txt
routes -> controllers -> services -> models
```

Avoid repositories, factories, CQRS, events, dependency injection containers, or generic base classes. The reviewer should be able to understand the code in about 10 minutes.

---

## 3. Required Endpoints

```http
POST   /login
GET    /books?page=1&limit=20
POST   /books
GET    /books/:id
PUT    /books/:id
DELETE /books/:id
GET    /feed
```

All endpoints except `/login` require a JWT.

---

## 4. Authorization Is The Most Important Part

Every book read/update/delete query must be scoped by the authenticated user's libraries:

```ts
library: { $in: req.user.libraries }
```

For create, reject libraries outside the user's membership:

```ts
if (!req.user.libraries.includes(body.library)) {
  throw new AppError('Forbidden', 403);
}
```

For update/delete, query by both book id and membership:

```ts
{ _id: id, library: { $in: req.user.libraries } }
```

Return `404` when a book is outside the user's libraries so the API does not leak existence.

---

## 5. Feed Should Be Correct, Not Perfect

Use Mongo aggregation. First restrict candidates to the user's libraries, then apply same-country priority, then sort by weighted score.

```ts
[
  { $match: { library: { $in: user.libraries } } },
  {
    $addFields: {
      sameCountry: {
        $cond: [{ $eq: ['$authorCountry', user.country] }, 1, 0]
      },
      ageInDays: {
        $dateDiff: {
          startDate: '$publishedDate',
          endDate: '$$NOW',
          unit: 'day'
        }
      }
    }
  },
  {
    $addFields: {
      score: {
        $add: [
          { $multiply: [{ $divide: [{ $min: ['$pages', 2000] }, 2000] }, 0.8] },
          { $multiply: [{ $divide: [{ $min: ['$ageInDays', 36500] }, 36500] }, 0.2] }
        ]
      }
    }
  },
  { $sort: { sameCountry: -1, score: -1 } },
  { $limit: 50 },
  { $project: { sameCountry: 0, ageInDays: 0, score: 0 } }
]
```

For assignment scope, this is enough. Document that a production-scale system would likely precompute or cache recommendation candidates.

---

## 6. Tests: Small But Strong

Minimum useful set:

```txt
POST /books creates a book
POST /books rejects invalid pages
POST /books rejects library outside user membership
GET /books/:id returns 404 for book outside user libraries
GET /feed verifies ranking behavior or pipeline shape
GET /feed returns 401 without token
```

If `aggregate()` is stubbed, do not pretend the endpoint test proves ranking. Test scoring/pipeline construction separately.

---

## 7. README Should Be Practical

Include:

```txt
How to run with Docker
How to run tests
Environment variables
Demo login credentials
Example API calls
Short design notes
How to find or use seeded library IDs
```

Keep the README short and runnable. The reviewer should not need to reverse-engineer how to create the first book.

---

## 8. Best Mindset

Build a clean, small, correct API.

Show senior thinking in the design notes and README, but keep the implementation direct and boring in the best way: clear services, scoped queries, focused validation, and tests around the risky parts.
