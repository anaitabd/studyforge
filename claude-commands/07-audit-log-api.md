The audit_logs table exists and is written to, but there is no read endpoint. Add admin access to audit logs.

Steps:
1. Add GET /api/v1/admin/audit-logs in app/api/v1/admin.py:
   - Requires super_admin role
   - Filters: actor_id (optional), resource_type (optional), resource_id (optional), action (optional), date_from, date_to
   - Cursor-based pagination (use pagination utility from app/core/pagination.py)
   - Returns AuditLogResponse: id, actor_id, actor_email, action, resource_type, resource_id, created_at, metadata

2. Add AuditLogResponse Pydantic schema

3. Add an Audit Logs page in apps/web/app/(app)/admin/audit-logs/:
   - Filterable table: search by user email, filter by resource_type dropdown, date range picker
   - Each row: timestamp, actor, action, resource_type + resource_id
   - Expandable row showing raw metadata JSON
   - Export as CSV button

Show complete backend route and frontend audit log page.
