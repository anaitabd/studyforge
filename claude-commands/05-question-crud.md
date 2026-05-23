Add the ability for teachers to edit, add, and delete individual questions in an exam after AI generation.

Currently there is no question-level management — the exam is immutable after generation.

Steps:
1. Add these FastAPI routes in app/api/v1/exams.py:
   - PATCH /groups/{id}/exams/{eid}/questions/{qid} — edit content, options, correct_answer, points, difficulty
   - DELETE /groups/{id}/exams/{eid}/questions/{qid} — delete, recalculate exam total_points
   - POST /groups/{id}/exams/{eid}/questions — manually add a new question
   - POST /groups/{id}/exams/{eid}/questions/{qid}/duplicate — duplicate for easy editing
   All require teacher/owner role. Only allow editing exams with no active sessions (status != "active").

2. Add QuestionUpdate and QuestionCreate Pydantic schemas

3. In the frontend exam editor (groups/[groupId]/exams):
   - Show questions in an editable list after generation
   - Inline edit: click any question to open an edit form
   - Delete button per question with confirmation dialog
   - "Add question manually" button opens blank question form
   - Support types: MCQ (4 options + correct answer selector), open-ended (model answer textarea), Moroccan Bac-style

Show complete backend routes, schemas, and the frontend question editor component.
