Build a dedicated Baccalauréat preparation mode — the most important exam for Moroccan students.

Backend steps:
1. Create bac_papers table:
   - id, year (int), branch (enum: SM, SE, SEco, SH, SAgro, SA, Lettres, Arts), subject, region (nationale/régionale), session (normale/rattrapage), file_id (FK to files), created_at

2. Add routes in a new app/api/v1/bac.py:
   - GET /bac/papers — list with filters: year, branch, subject, session
   - POST /bac/papers — admin uploads a past paper (links to uploaded file)
   - POST /bac/practice — create a timed practice session from a past paper
   - GET /bac/practice/{session_id} — get session with questions
   - POST /bac/practice/{session_id}/submit — submit and auto-grade
   - GET /bac/stats — user's practice stats: average score by subject, improvement over time

3. Create BacService in app/services/bac_service.py:
   - Uses AIService to extract questions from Bac paper PDFs
   - Grades open-ended answers against official rubrics (Moroccan 0–20 scale)
   - Gives detailed feedback per question in both Arabic and French

Frontend steps:
4. Add /bac route:
   - Branch selector (SM, SE, SEco, SH...) → Subject → Year filter
   - Paper browser with difficulty indicators
   - Timed exam mode: countdown timer, one question at a time, no going back (real exam simulation)
   - Results page: score out of 20, question-by-question breakdown, AI feedback
   - Progress tracker: score history chart per subject over multiple attempts

Show complete backend models, service, routes, and Bac prep frontend pages.
