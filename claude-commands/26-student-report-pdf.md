Add one-click PDF progress report generation per student for teachers.

Backend steps:
1. Add GET /api/v1/teacher/groups/{id}/students/{user_id}/report in app/api/v1/teacher.py:
   - Collects: student profile, study time (last 30 days), exam scores with subject breakdown, flashcard retention rate, streak, XP level, top 3 weak areas, days active

2. Create app/services/report_service.py:
   - Uses WeasyPrint or ReportLab to generate a PDF
   - Layout: school logo area (from org settings), student name + initials avatar, date range, summary metric boxes, exam scores table, weak areas bar chart, AI-written paragraph summary in French/Arabic
   - Save temporarily to GCS with 24-hour signed URL

3. Dispatch PDF generation to Celery (slides queue) since it takes a few seconds

4. Add GET /api/v1/teacher/groups/{id}/students/{user_id}/report/status — poll until ready

Frontend steps:
5. In teacher analytics page (student drill-down view):
   - "Générer le rapport" button
   - Loading spinner while PDF generates (polls status endpoint every 2 seconds)
   - Once ready: "Télécharger PDF" button
   - "Envoyer par email" option to the student
   - "Envoyer aux parents via WhatsApp" option (uses parent phone from parent portal)

Show complete report service, PDF layout code, routes, and the frontend report generation flow.
