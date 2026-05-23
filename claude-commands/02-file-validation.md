Add server-side file validation to the upload endpoint POST /api/v1/groups/{id}/files.

Steps:
1. In the FastAPI route (app/api/v1/files.py), before dispatching to Celery:
   - Check MIME type using python-magic (not just extension — extensions are spoofable)
   - Allowed: application/pdf, .docx, .pptx, text/plain, image/jpeg, image/png, image/webp
   - Raise HTTP 415 if type is not allowed

2. Enforce file size limits from app/core/plans.py based on user's plan:
   - Free: 10MB max
   - Personal: 50MB max
   - School: 200MB max
   - Raise HTTP 413 with a clear message if exceeded

3. Add the file size limits to app/core/plans.py plan definitions

4. In the frontend file upload component, add client-side pre-checks (same limits) with clear error toasts before upload starts — give instant feedback, don't wait for the server

5. Show a file type badge on each file card in the UI (PDF, DOCX, PPTX, TXT, Image)

Show complete backend validation code and the updated frontend upload component with error states.
