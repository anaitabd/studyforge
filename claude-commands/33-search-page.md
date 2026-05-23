Add a global search UI. The backend GET /api/v1/search endpoint exists but there is no frontend entry point.

Backend steps:
1. Verify GET /search handles: q (query string), group_id (optional filter), type (files/exams/flashcards/forum), cursor pagination
2. Ensure it uses PostgreSQL full-text search (tsvector/tsquery)
3. Results must include a text snippet with match highlighted using ts_headline
4. Add pg_trgm index if current search is too slow for partial matches

Frontend steps:
5. Add a global search bar in the layout header with keyboard shortcut Cmd+K / Ctrl+K:
   - Opens a modal (use faux viewport pattern — not position:fixed)
   - Instant search: debounce 300ms, call /search, show results in modal
   - Result types with icons: Files, Exams, Flashcard sets, Forum posts
   - Each result: title, snippet with match highlighted, group name, last updated
   - Press Enter or click to navigate to the item
   - Recent searches stored in localStorage (last 5)

6. Full search results page /search?q=...:
   - Filter tabs: Tout / Fichiers / Examens / Cartes mémoire / Forum
   - Group filter dropdown (search within specific group)
   - Paginated results grid using the same card design as the modal
   - URL updates on filter change so results are shareable

Show backend search query with ts_headline, the Cmd+K search modal component, and the full search results page.
