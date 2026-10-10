# Research Collaboration Platform

Next.js + MySQL + ChromaDB.

| Part | Owner | Contents |
|------|-------|----------|
| Person 1 — Research Paper Management | — | `Authors`, `ResearchPapers`, `PaperAuthors` tables; paper CRUD; search by title / author / domain; ChromaDB semantic search; `/papers` pages |
| Person 2 — Users & Collaboration | Chandana | `Users`, `Bookmarks`, `Collaborations`, `Comments`, `Ratings`; register/login; dashboard; bookmarks; collaboration pages |

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create the database** (safe to re-run; does not touch tables that already exist)
   ```bash
   mysql -u root -p < db/schema.sql
   mysql -u root -p research_collaboration < db/seed.sql   # optional: 9 sample papers
   ```
3. **Configure** – copy `.env.example` to `.env.local` and set `DB_PASSWORD`.
4. **Start ChromaDB** (needs Python 3.9+), in a separate terminal:
   ```bash
   pip install chromadb
   chroma run --path ./chroma_data --port 8000
   ```
5. **Run the app**
   ```bash
   npm run dev
   ```
   Register, log in, open **Research Papers**, then click **Rebuild semantic index** once
   (needed after loading `seed.sql`; new/edited papers are indexed automatically).

The first semantic search downloads the ~90 MB `all-MiniLM-L6-v2` model, so it needs internet once.
Without internet, set `EMBEDDING_PROVIDER=hash` (matches shared words only, not meaning).
If ChromaDB is not running, everything else still works; only semantic search is unavailable.

## Database design (Person 1)

```
Users 1───< ResearchPapers >───< PaperAuthors >───< Authors
                  │
                  ├───< Bookmarks      (Person 2)
                  ├───< Comments       (Person 2)
                  └───< Ratings        (Person 2)
```

* `Authors` ↔ `ResearchPapers` is many-to-many through `PaperAuthors` (`author_order` keeps the byline order).
* `ResearchPapers.uploaded_by` → `Users.user_id` (`ON DELETE SET NULL`).
* Deleting a paper cascades to its `PaperAuthors`, bookmarks, comments and ratings. Authors left with no papers are removed.
* `db/schema.sql` also contains the Person 2 tables, reconstructed from their API routes, so a fresh database works end to end.
  If you already have those tables they are left untouched.

## Paper API

| Method & route | Purpose |
|----------------|---------|
| `GET /api/papers?title=&author=&domain=&sort=newest\|year\|title&page=&limit=` | List / search (filters combine with AND) |
| `POST /api/papers` | Add a paper. Body: `user_id, title, domain, authors[{full_name, affiliation}]`, optional `abstract, publication_year, keywords, doi, pdf_url` |
| `GET /api/papers/:id` | Paper with authors |
| `PUT /api/papers/:id` | Edit (same body as POST). Only the uploader may edit; papers with no owner (seed data) can be edited by any logged-in user |
| `DELETE /api/papers/:id` | Delete. Body: `{ user_id }`. Same ownership rule |
| `GET /api/papers/semantic?q=&limit=` | Semantic search through ChromaDB, ranked with a 0–1 similarity score |
| `POST /api/papers/reindex` | Body `{ user_id }`. Rebuilds the ChromaDB index from MySQL |
| `GET /api/papers/domains` | Domains with paper counts (filter dropdown) |
| `GET /api/authors?q=` | Author name lookup (form autocomplete) |

MySQL is the source of truth; ChromaDB only stores embeddings (`paper_id` is the Chroma id).

## Pages

`/papers` (listing, keyword + semantic search, pagination) · `/papers/new` · `/papers/[id]` (details, bookmark, edit, delete) · `/papers/[id]/edit`

## Notes

* Login state lives in `localStorage` and API routes trust the `user_id` sent by the browser (existing design from Person 2). Fine for a course project; a real deployment would use server-side sessions.
