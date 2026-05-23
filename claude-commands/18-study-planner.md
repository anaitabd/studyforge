Build an AI-generated personal study schedule based on upcoming exams, weak areas, and available time.

Backend steps:
1. Create study_plans table:
   - id, user_id, week_start (date), generated_at, plan_json (JSONB), status (active/archived)
   - plan_json schema: { days: [{ date, slots: [{ time, duration_minutes, group_id, activity_type, topic, resource_id }] }] }

2. Add routes in app/api/v1/planner.py:
   - POST /me/study-plan/generate — generates a new week plan (max once per day)
   - GET /me/study-plan — returns current active plan
   - PATCH /me/study-plan/slots/{slot_id}/complete — marks slot as done, awards XP
   - GET /me/study-plan/history — past plans and completion rates

3. In app/services/planner_service.py:
   - Gather: upcoming exam deadlines, student mastery scores (weak areas), flashcard due counts, user's available hours per day (from goals table)
   - Build a prompt that generates a balanced week schedule
   - Respect Moroccan schedule: peak study after 16:00, Friday adjustment
   - Validate and store the plan_json

Frontend steps:
4. Add /goals/planner page:
   - Weekly calendar view (Mon–Sun) with time slots
   - Each slot: subject, activity type icon (flashcards/exam/reading), duration
   - Check off completed slots → week progress bar
   - "Régénérer le planning" button
   - Monday 08:00 WhatsApp/in-app notification: "Votre planning de la semaine est prêt"

Show complete planner service with prompt, routes, and the weekly calendar frontend component.
