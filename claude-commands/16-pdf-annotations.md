Let students highlight text in uploaded documents and add personal notes that are searchable and can generate flashcards.

Backend steps:
1. Create annotations table:
   - id, user_id, file_id, page_number, selected_text (text), note (text nullable), color (hex), created_at

2. Add routes in app/api/v1/annotations.py:
   - POST /files/{fid}/annotations — create (selected_text + optional note + color + page)
   - GET /files/{fid}/annotations — list user's annotations for a file
   - PATCH /files/{fid}/annotations/{aid} — update note text
   - DELETE /files/{fid}/annotations/{aid}
   - POST /files/{fid}/annotations/to-flashcards — convert all annotations into a flashcard set using AI (front = selected_text, back = AI explanation)

3. Add GET /me/annotations — all annotations across all groups (for personal notes view)

Frontend steps:
4. In the file viewer, integrate PDF.js for rendering:
   - Allow text selection → show popup: color options (yellow, blue, pink, green) + "Add note" input
   - Render existing annotations as colored highlights on PDF pages
   - Sidebar panel showing all annotations grouped by page
   - Click annotation in sidebar to jump to that page

5. Add "My Notes" section in dashboard showing recent annotations across all groups

6. "Convert to flashcards" button in the annotations panel

Show complete annotations model, routes, PDF.js integration with highlight rendering, and annotation sidebar component.
