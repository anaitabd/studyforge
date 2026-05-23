Pre-load official Moroccan MEN (Ministère de l'Éducation Nationale) textbooks so students can study without uploading anything.

Backend steps:
1. Create system_files table:
   - id, title_fr, title_ar, level, grade, branch, subject, academic_year, source_url, file_path (GCS), status, created_at

2. Create management command scripts/seed_textbooks.py:
   - Downloads official textbook PDFs from manuelscolaires.men.gov.ma (publicly available)
   - Uploads to GCS under system/ prefix
   - Inserts records into system_files
   - Run as one-time seeder and re-run annually for new editions

3. Add GET /api/v1/textbooks — filters: level, grade, branch, subject. No auth required. Cached in Redis 1h TTL.

4. Add POST /api/v1/groups/{id}/textbooks/{textbook_id}:
   - Copies system file into the group (creates files record pointing to same GCS object)
   - Triggers process_file_task to embed it into ChromaDB for this group
   - Requires teacher/owner role

Frontend steps:
5. Add "Ajouter un manuel scolaire" button in the group files section:
   - Opens modal with level/grade/branch/subject filters
   - Shows matching official textbooks with cover thumbnails
   - One-click to add — no upload needed
   - "Manuel officiel MEN" badge on each book

Show complete backend models, seeder script, routes, and the textbook picker modal.
