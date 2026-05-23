Add proper retry policy and dead-letter queue handling to all Celery tasks.

Currently failed tasks silently die with no recovery path.

Steps:
1. In app/tasks/celery_app.py, configure default retry policy:
   - autoretry_for = (Exception,)
   - max_retries = 3
   - retry_backoff = True (exponential: 60s, 120s, 240s)
   - retry_jitter = True

2. For process_file_task specifically:
   - On final failure (after 3 retries), update file status to ERROR with descriptive error_message in DB
   - Send an in-app notification to the file owner explaining the failure
   - Log the full exception to Sentry

3. Create a dead-letter mechanism: add a failed_tasks table (task_id, task_name, args, error, created_at, retried_at) and write to it on final failure

4. Add a user-facing retry endpoint: POST /api/v1/groups/{id}/files/{fid}/retry
   - Allows the file owner (not just admin) to re-queue a failed file
   - Check file status == ERROR before allowing

5. Add a "Retry" button to the frontend file list for files in ERROR state

Show complete code: celery_app.py changes, updated process_file_task, the retry endpoint, and the frontend retry button.
