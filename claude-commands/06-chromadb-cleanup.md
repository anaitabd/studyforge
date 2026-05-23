Ensure ChromaDB vector embeddings are properly cleaned up when files or groups are deleted.

Currently group delete does not clean up ChromaDB, leaving orphaned embeddings forever.

Steps:
1. In app/services/vector_store.py, ensure these methods exist:
   - delete_file_embeddings(file_id: str) — delete all vectors where metadata file_id == file_id
   - delete_group_collection(group_id: str) — delete the entire ChromaDB collection for this group
   - Both should handle non-existent collection/document gracefully (no-op, no exception)

2. In app/api/v1/files.py DELETE handler:
   - After DB deletion, call vector_store.delete_file_embeddings(file_id) in a try/except
   - If ChromaDB is unavailable, log the error and continue — don't fail the delete

3. In app/api/v1/groups.py DELETE handler:
   - After DB deletion, dispatch Celery task delete_group_vectors_task to the files queue
   - Task calls vector_store.delete_group_collection(group_id) and logs the result

4. Add delete_group_vectors_task to app/tasks/file_tasks.py

Show complete code for all four changes.
