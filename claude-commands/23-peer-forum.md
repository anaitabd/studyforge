Add a peer Q&A forum inside each group — students ask questions, peers and teachers answer. Replaces informal WhatsApp study groups.

Backend steps:
1. Create tables:
   - forum_questions: id, group_id, user_id, title, body, tags (text[]), views, is_answered, accepted_answer_id, created_at
   - forum_answers: id, question_id, user_id, body, upvotes, is_accepted, created_at
   - forum_votes: user_id, answer_id, value (1 or -1), created_at

2. Add routes in app/api/v1/forum.py:
   - GET/POST /groups/{id}/forum — list/create questions (paginated, sort: recent/unanswered/most_votes)
   - GET /groups/{id}/forum/{qid} — question detail + answers
   - POST /groups/{id}/forum/{qid}/answers — post an answer
   - POST /groups/{id}/forum/{qid}/answers/{aid}/vote — upvote/downvote
   - PATCH /groups/{id}/forum/{qid}/answers/{aid}/accept — teacher/owner marks as accepted
   - GET /groups/{id}/forum/unanswered — feed for teachers to prioritize

3. XP rewards via GamificationService:
   - Ask a question: +5 XP
   - Answer a question: +15 XP
   - Answer accepted: +50 XP

4. If a question is unanswered after 24 hours, trigger an AI answer via RAG pipeline — marked "Suggestion IA, en attente de validation par l'enseignant"

Frontend steps:
5. Add Forum tab inside group pages:
   - Question list with tabs: Toutes / Sans réponse / Mes questions
   - Question detail page with threaded answers
   - Markdown editor for questions and answers with preview
   - Tags (e.g., #dérivées #chimie #bac) — auto-suggested based on group subject
   - Teacher badge on teacher answers, accepted answer highlighted green at top

Show complete backend models, routes, XP integration, AI auto-answer trigger, and forum frontend components.
