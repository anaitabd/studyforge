Add cursor-based pagination to all list endpoints in the FastAPI backend.

Currently these endpoints return unbounded lists which will break under load:
- GET /groups/{id}/files
- GET /groups/{id}/exams
- GET /groups/{id}/flashcards
- GET /groups/{id}/learning-paths
- GET /groups/{id}/slide-decks
- GET /groups/{id}/members
- GET /notifications
- GET /admin/users/search

Steps:
1. Create a reusable pagination utility in app/core/pagination.py:
   - PaginationParams (limit: int = 20, cursor: str | None = None) as a FastAPI Depends
   - PageResponse[T] generic Pydantic schema: { items: List[T], next_cursor: str | None, total: int }
   - cursor is base64-encoded last item ID for stable ordering

2. Apply PaginationParams to all list endpoints above using SQLAlchemy .limit() and .where(id > cursor)

3. Return PageResponse for each

4. Update the corresponding TanStack Query hooks in apps/web/lib/hooks/ to use useInfiniteQuery with getNextPageParam reading next_cursor

5. Add a "Load more" button to each list component in the frontend

Show complete code for pagination.py, one example updated route (files list), and the updated React hook.
