from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.permissions import Permission

_ROLE_RANK: dict[str, int] = {"admin": 4, "teacher": 3, "student": 2, "viewer": 1}


async def get_permission(
    db: AsyncSession, actor_id: str, resource_type: str, resource_id: str
) -> Permission | None:
    result = await db.execute(
        select(Permission).where(
            Permission.actor_id == actor_id,
            Permission.resource_type == resource_type,
            Permission.resource_id == resource_id,
        )
    )
    return result.scalar_one_or_none()


def require_permission(resource_type: str, resource_id_param: str, min_role: str):
    """
    FastAPI Depends factory. resource_id_param is the path parameter name
    (e.g. 'slug' or 'cohort_id'). Role hierarchy: admin > teacher > student > viewer.
    super_admin users bypass RBAC entirely.
    """
    async def dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        if current_user.role == "super_admin":
            return current_user

        resource_id = request.path_params.get(resource_id_param)
        if not resource_id:
            raise HTTPException(status_code=400, detail="missing_resource_id")

        perm = await get_permission(db, current_user.id, resource_type, resource_id)
        if perm is None:
            raise HTTPException(status_code=403, detail="insufficient_permission")

        if _ROLE_RANK.get(perm.role, 0) < _ROLE_RANK.get(min_role, 0):
            raise HTTPException(status_code=403, detail="insufficient_permission")

        return current_user

    return Depends(dependency)
