Add a parent role that can monitor their child's progress without accessing study content.

Backend steps:
1. Create parent_student_links table:
   - parent_user_id, student_user_id, verified (bool), created_at

2. Add 'parent' to the user role enum in users table

3. New routes in app/api/v1/parent.py (all read-only):
   - POST /parent/link-student — parent provides student email → sends verification code to student
   - POST /parent/link-student/verify — student accepts the link (verifies from their account)
   - GET /parent/children — list linked students
   - GET /parent/children/{student_id}/overview — weekly study time, exam scores, streak, XP, active groups
   - GET /parent/children/{student_id}/exams — recent exam sessions and scores
   - GET /parent/children/{student_id}/weak-areas — student's identified weak areas

4. Weekly summary Celery task (runs Monday 08:00 Morocco time = UTC+1):
   - For each parent, aggregate child's past week stats
   - Send WhatsApp message via Twilio in French or Arabic (based on parent preference)
   - FR: "Résumé hebdomadaire de {name}: ⏱ {hours}h d'étude | 📝 {exams} examens ({avg}/20 moy.) | 🔥 Série de {streak} jours | ⚠️ Points faibles: {topics}"
   - AR: "ملخص أسبوعي لـ{name}: ⏱ {hours} ساعات دراسة | 📝 {exams} اختبارات ({avg}/20 معدل)"

Frontend steps:
5. Parent dashboard at /parent:
   - Simple layout — no study UI, just progress visibility
   - Child switcher at top if multiple children linked
   - Cards: weekly study time, current streak, last exam score
   - Recent activity feed: "Yassine a terminé une session de cartes mémoire — 85% rétention"
   - Weak areas list with "Aider votre enfant à pratiquer" → shareable flashcard link

Show complete parent linking flow, backend routes, weekly summary Celery task, and parent dashboard.
