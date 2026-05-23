Make exam generation and flashcard difficulty adapt automatically based on each student's performance history.

Backend steps:
1. Create student_mastery table:
   - user_id, group_id, topic (text), mastery_score (0.0–1.0), last_updated
   - Updated after every exam session submission and flashcard review

2. In app/services/exam_service.py, add adaptive generation:
   - Before generating, query student_mastery for the requesting user in this group
   - Pass mastery scores to AI prompt: "Student has mastered: [topics]. Student struggles with: [topics]. Generate more questions on weak areas."
   - Difficulty distribution: 40% hard on weak topics, 40% medium, 20% easy on mastered topics

3. In app/services/flashcard_service.py, modify SM-2 scheduling:
   - mastery_score < 0.4: halve the SM-2 interval (review sooner)
   - mastery_score > 0.8: allow interval to grow 20% faster than standard SM-2

4. After each exam session submission, call update_student_mastery(user_id, group_id, session_results) in background via Celery

5. Add GET /api/v1/groups/{id}/my-mastery — returns {topic, mastery_score, question_count}

Frontend steps:
6. Show a mastery radar chart on student's group page (recharts RadarChart) — one axis per major topic, filled based on mastery_score
7. In exam generation form, show "Personnalisé pour mon niveau" toggle — when on, uses adaptive difficulty

Show complete mastery tracking service, adaptive generation prompt, and mastery radar chart component.
