Add PATCH /api/v1/groups/{id} endpoint. Currently groups are immutable after creation — no update endpoint exists.

Steps:
1. Create GroupUpdate Pydantic schema (all fields optional):
   - name: str | None
   - color: str | None (hex color)
   - visibility: str | None ("public" | "private")
   - school_id: int | None

2. Add PATCH /api/v1/groups/{id} route in app/api/v1/groups.py:
   - require_permission for "owner" or "teacher" role
   - Partial update: only update fields that are not None
   - Return updated GroupResponse

3. In the frontend, add a group settings page or modal at groups/[groupId]/settings:
   - Form with name input, color picker, visibility toggle
   - Uses PATCH via TanStack Query mutation with optimistic update
   - Accessible from a settings icon in the group header

Show complete backend route, schema, and frontend settings form component.
