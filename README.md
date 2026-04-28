# Book Management API

RESTful Node.js + TypeScript API for managing books with MongoDB, JWT auth, scoped library access, and a ranked feed endpoint.

## Run With Docker

```bash
docker compose up --build
```

The API runs on `http://localhost:3000`.

For real use, replace the `JWT_SECRET` value in `docker-compose.yml` with your own 32+ character secret.

## Run Locally

```bash
npm install
cp .env.example .env
npm run dev
```

Set `MONGO_URI` in `.env` to a running MongoDB instance.

## Demo Users

Seed data is loaded on startup. Demo password for both users:

```txt
password123
```

Users:

```txt
alice / password123
bob / password123
```

## Common Requests

Login:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

List books:

```bash
curl http://localhost:3000/books?page=1\&limit=20 \
  -H "Authorization: Bearer <token>"
```

Use the `library` value from one of the seeded books in the list response when creating a new book. For example, after logging in as `alice`, call `GET /books` and copy a `library` ID from any returned book.

Create a book:

```bash
curl -X POST http://localhost:3000/books \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Clean API Design",
    "author": "Jane Carter",
    "authorCountry": "US",
    "publishedDate": "2020-01-01",
    "pages": 320,
    "library": "<libraryId>"
  }'
```

Get a single book:

```bash
curl http://localhost:3000/books/<bookId> \
  -H "Authorization: Bearer <token>"
```

Update a book:

```bash
curl -X PUT http://localhost:3000/books/<bookId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"pages": 400}'
```

Delete a book:

```bash
curl -X DELETE http://localhost:3000/books/<bookId> \
  -H "Authorization: Bearer <token>"
```

Feed:

```bash
curl http://localhost:3000/feed \
  -H "Authorization: Bearer <token>"
```

## Feed Ranking

The feed endpoint first restricts candidates to the authenticated user's libraries, then applies a hard priority bucket for same-country authors, and finally ranks books inside each bucket using a normalized weighted score: 80% pages and 20% age.

`authorCountry` is stored on `Book` because the assignment requires author-country ranking but does not define an Author entity.

## Scripts

```bash
npm run dev
npm run build
npm test
```
