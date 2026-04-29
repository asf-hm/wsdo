#!/usr/bin/env bash
# Run against a live server: BASE_URL=http://localhost:3000 ./scripts/test-api.sh

set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf "${GREEN}✓${NC} %s\n" "$name"
    ((PASS++)) || true
  else
    printf "${RED}✗${NC} %s — expected %s, got %s\n" "$name" "$expected" "$actual"
    ((FAIL++)) || true
  fi
}

section() { printf "\n${YELLOW}── %s${NC}\n" "$1"; }

# ── 1. Authentication ────────────────────────────────────────────────────────

section "Authentication"

ALICE=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}')
ALICE_TOKEN=$(echo "$ALICE" | jq -r '.token')
check "alice login returns 200 with token" "true" "$([ -n "$ALICE_TOKEN" ] && [ "$ALICE_TOKEN" != "null" ] && echo true || echo false)"

BOB=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","password":"password123"}')
BOB_TOKEN=$(echo "$BOB" | jq -r '.token')
check "bob login returns 200 with token" "true" "$([ -n "$BOB_TOKEN" ] && [ "$BOB_TOKEN" != "null" ] && echo true || echo false)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"wrong"}')
check "wrong password returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"nobody","password":"password123"}')
check "unknown user returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}')
check "missing password returns 400" "400" "$STATUS"

# ── 2. Auth guard ────────────────────────────────────────────────────────────

section "Auth guard"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books")
check "GET /books without token returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books" \
  -H "Authorization: Bearer invalid.token.here")
check "GET /books with invalid token returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/feed")
check "GET /feed without token returns 401" "401" "$STATUS"

# ── 3. List books ────────────────────────────────────────────────────────────

section "List books"

LIST=$(curl -s "$BASE/books" -H "Authorization: Bearer $ALICE_TOKEN")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /books returns 200" "200" "$STATUS"
check "GET /books returns pagination" "true" "$(echo "$LIST" | jq 'has("pagination")')"
check "GET /books default page is 1" "1" "$(echo "$LIST" | jq '.pagination.page')"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books?limit=9999" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /books?limit=9999 returns 200" "200" "$STATUS"
CLAMPED=$(curl -s "$BASE/books?limit=9999" -H "Authorization: Bearer $ALICE_TOKEN" \
  | jq '.pagination.limit')
check "limit is clamped to max (100)" "100" "$CLAMPED"

# Extract IDs for subsequent tests
BOOK_ID=$(echo "$LIST" | jq -r '.data[0]._id')
LIBRARY_ID=$(echo "$LIST" | jq -r '.data[0].library')

# ── 4. Get single book ───────────────────────────────────────────────────────

section "Get single book"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books/$BOOK_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /books/:id returns 200" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books/not-an-objectid" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /books/invalid-id returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books/000000000000000000000099" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /books/unknown-id returns 404" "404" "$STATUS"

# Bob can't see City Library books (find a City Library book by checking alice's list)
CITY_BOOK_ID=$(curl -s "$BASE/books?limit=100" -H "Authorization: Bearer $ALICE_TOKEN" \
  | jq -r '[.data[] | select(.library != null)] | .[0]._id')
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/books/$CITY_BOOK_ID" \
  -H "Authorization: Bearer $BOB_TOKEN")
# Bob only has Central Library — a City Library book should be 404 for him
check "bob cannot see alice-only library books (404)" "404" "$STATUS"

# ── 5. Create book ───────────────────────────────────────────────────────────

section "Create book"

CREATE=$(curl -s -w "\n%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test Book\",\"author\":\"Test Author\",\"authorCountry\":\"US\",\"publishedDate\":\"2020-06-15\",\"pages\":350,\"library\":\"$LIBRARY_ID\"}")
CREATE_STATUS=$(echo "$CREATE" | tail -1)
CREATE_BODY=$(echo "$CREATE" | head -1)
check "POST /books returns 201" "201" "$CREATE_STATUS"
NEW_BOOK_ID=$(echo "$CREATE_BODY" | jq -r '._id')

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"\",\"author\":\"Test\",\"authorCountry\":\"US\",\"publishedDate\":\"2020-01-01\",\"pages\":100,\"library\":\"$LIBRARY_ID\"}")
check "POST /books empty title returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test\",\"author\":\"Test\",\"authorCountry\":\"US\",\"publishedDate\":\"2020-01-01\",\"pages\":0,\"library\":\"$LIBRARY_ID\"}")
check "POST /books pages=0 returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test\",\"author\":\"Test\",\"authorCountry\":\"US\",\"publishedDate\":\"2020-01-01\",\"pages\":99999,\"library\":\"$LIBRARY_ID\"}")
check "POST /books pages=99999 returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test\",\"author\":\"Test\",\"authorCountry\":\"US\",\"publishedDate\":\"2099-01-01\",\"pages\":300,\"library\":\"$LIBRARY_ID\"}")
check "POST /books future publishedDate returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test\",\"author\":\"Test\",\"authorCountry\":\"US\",\"publishedDate\":\"2020-01-01\",\"pages\":300,\"library\":\"000000000000000000000099\"}")
check "POST /books non-member library returns 403" "403" "$STATUS"

# ── 6. Update book ───────────────────────────────────────────────────────────

section "Update book"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/books/$NEW_BOOK_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pages":500}')
check "PUT /books/:id returns 200" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/books/$NEW_BOOK_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
check "PUT /books/:id empty body returns 400" "400" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/books/$NEW_BOOK_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"library":"000000000000000000000099"}')
check "PUT /books/:id non-member library returns 403" "403" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/books/000000000000000000000099" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pages":100}')
check "PUT /books/unknown-id returns 404" "404" "$STATUS"

# ── 7. Delete book ───────────────────────────────────────────────────────────

section "Delete book"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/books/000000000000000000000099" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "DELETE /books/unknown-id returns 404" "404" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/books/$NEW_BOOK_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "DELETE /books/:id returns 204" "204" "$STATUS"

# ── 8. Feed ──────────────────────────────────────────────────────────────────

section "Feed"

ALICE_FEED=$(curl -s "$BASE/feed" -H "Authorization: Bearer $ALICE_TOKEN")
ALICE_FEED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/feed" \
  -H "Authorization: Bearer $ALICE_TOKEN")
check "GET /feed returns 200 for alice" "200" "$ALICE_FEED_STATUS"
check "GET /feed returns an array" "true" "$(echo "$ALICE_FEED" | jq 'type == "array"')"

FIRST_COUNTRY=$(echo "$ALICE_FEED" | jq -r '.[0].authorCountry // "NONE"')
check "alice feed first book is from US (same country first)" "US" "$FIRST_COUNTRY"

BOB_FEED=$(curl -s "$BASE/feed" -H "Authorization: Bearer $BOB_TOKEN")
BOB_FEED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/feed" \
  -H "Authorization: Bearer $BOB_TOKEN")
check "GET /feed returns 200 for bob" "200" "$BOB_FEED_STATUS"

BOB_FIRST_COUNTRY=$(echo "$BOB_FEED" | jq -r '.[0].authorCountry // "NONE"')
check "bob feed first book is from GB (same country first)" "GB" "$BOB_FIRST_COUNTRY"

# ── 9. Not found ─────────────────────────────────────────────────────────────

section "Not found"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent")
check "unknown route returns 404" "404" "$STATUS"

# ── Summary ──────────────────────────────────────────────────────────────────

printf "\n──────────────────────────────\n"
printf "${GREEN}passed: %d${NC}  ${RED}failed: %d${NC}\n" "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
