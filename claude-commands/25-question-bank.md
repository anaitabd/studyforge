Add a personal question bank for teachers — a reusable library of questions they can insert into any exam.

Backend steps:
1. Create question_bank table:
   - id, owner_user_id, question_type (MCQ/open/bac), content, options (JSONB), correct_answer, difficulty, subject, tags (text[]), source (manual/ai_generated), usage_count, created_at

2. Add routes in app/api/v1/question_bank.py:
   - GET /me/question-bank — list with filters: type, difficulty, subject, tags, search text. Paginated.
   - POST /me/question-bank — create question manually
   - PATCH /me/question-bank/{qid} — edit
   - DELETE /me/question-bank/{qid}
   - POST /me/question-bank/import-from-exam/{exam_id} — bulk import all questions from a past exam
   - POST /groups/{id}/exams/{eid}/questions/from-bank — insert a question from bank into an exam

3. When AI-generated exam is created, optionally save all questions to teacher's bank
   - Add save_to_bank: bool field to exam generation request body

Frontend steps:
4. Add "Banque de questions" page accessible from teacher navigation:
   - Searchable, filterable grid of question cards
   - Each card: type badge, difficulty dots, first 80 chars of question, subject tag, usage count
   - Multi-select to insert multiple questions into an exam at once
   - Import from exam button (select past exam from dropdown)

5. In the exam editor (from 05-question-crud), add "Ajouter depuis la banque" button:
   - Opens a side drawer with the question bank
   - Search and select questions to insert directly

Show complete question bank model, routes, the question bank page, and exam editor integration.
