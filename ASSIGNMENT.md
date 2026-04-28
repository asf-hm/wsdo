# Home Assignment: Node.js Backend Developer

## What to Build: Book Management API

Develop a RESTful API for managing books, supporting full CRUD operations:
- Create
- Read (list & single item)
- Update
- Delete

Data should be persisted in a MongoDB database using Mongoose.

---

## Entities

### Book
- `title` (string)
- `author` (string)
- `publishedDate` (date)
- `pages` (number)
- `library` (reference to the Library this book belongs to)

### Library
- `name` (string)
- `location` (string)

### User
- `username` (string)
- `country` (string)
- `libraries` (array of Library IDs the user belongs to)
- `role` (optional: either `admin` or `user`)

> **Important:** Only implement full CRUD endpoints for Books. For Users and Libraries, simply preload some sample data; no CRUD endpoints are required.

---

## REST Principles

- Design endpoints following REST principles (resources, verbs, URLs).
- Implement proper input validation (e.g., non-empty title/author, pages > 0).
- Ensure users can only create or view books in libraries they are members of.

---

## Feed (Algorithmic Endpoint)

Implement a `GET /feed` endpoint that returns a ranked list of books recommended for the authenticated user.

### Feed Rules

- Include only books from libraries the user is a member of.
- Prioritize books by authors from the same country as the user.
- Then, rank books by a weighted score:
  - **80%** number of pages (longer = higher)
  - **20%** age of the book (older = higher)
- Return books sorted by relevance descending.
- Return an empty array if no books are found.

> **Note:** The dataset may contain millions of books.

---

## Authentication

All `/books` and `/feed` endpoints must be protected and require a valid JWT in the `Authorization: Bearer …` header.

### `POST /login`
- Returns a JWT upon successful authentication.
- Users are predefined (hardcoded or in-memory).
- Example user structure:
  ```json
  {
    "username": "admin",
    "password": "password123",
    "country": "US",
    "libraries": ["library_id_1", "library_id_2"]
  }
  ```
- If credentials are correct, return a signed JWT (secret stored in `.env`).
- If incorrect, return a `401` status.

---

## Docker

- `Dockerfile` for the application.
- `docker-compose.yml` to spin up both the application and MongoDB.
- Ensure MongoDB connection uses environment variables.

---

## Tests

- Write automated tests for at least one CRUD endpoint and the `/feed` endpoint.
- Use **Mocha + Sinon**.
- Include at least one negative scenario (e.g., invalid input).
- Bonus points for additional test coverage.

---

## Required Technologies

| Technology | Purpose |
|---|---|
| Node.js + Express | Server framework |
| TypeScript | Language |
| MongoDB + Mongoose | Database & ODM |
| JWT | Authentication |
| Docker | Containerization |
| Mocha + Sinon | Testing |

---

## What to Submit

- Code in a public GitHub repository or as a zip file.
- A `README.md` with instructions on how to run the application.
