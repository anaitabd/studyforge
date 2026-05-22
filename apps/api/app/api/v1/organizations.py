import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_permission, require_permission
from app.core.security import get_current_user
from app.models.assignment import Assignment, AssignmentProgress
from app.models.cohort import Cohort, CohortMember
from app.models.goal import KpiCache
from app.models.organization import Organization
from app.models.permissions import Permission
from app.models.user import User
from app.schemas.organization import (
    AssignmentCreate,
    BulkInvite,
    CohortCreate,
    CohortMemberAdd,
    CohortUpdate,
    MemberInvite,
    MemberRoleUpdate,
    OrgCreate,
    OrgUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/org", tags=["organizations"])

CurrentUser = Annotated[object, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]

_ROLE_RANK = {"admin": 4, "teacher": 3, "student": 2, "viewer": 1}


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_org_by_slug(slug: str, db: AsyncSession) -> Organization:
    org = (await db.execute(
        select(Organization).where(Organization.slug == slug, Organization.is_active == True)
    )).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def _require_org_role(db: AsyncSession, user_id: str, org_id: str, min_role: str):
    """Raises 403 if the user doesn't hold at least min_role in this org."""
    perm = await get_permission(db, user_id, "org", org_id)
    if perm is None or _ROLE_RANK.get(perm.role, 0) < _ROLE_RANK.get(min_role, 0):
        raise HTTPException(status_code=403, detail="insufficient_permission")
    return perm


# ── org management ─────────────────────────────────────────────────────────────

@router.post("")
async def create_org(body: OrgCreate, current_user: CurrentUser, db: DB):
    """Create a new organization. The creator becomes the admin."""
    existing = (await db.execute(
        select(Organization).where(Organization.slug == body.slug)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="slug_already_taken")

    org = Organization(
        id=str(uuid.uuid4()),
        name=body.name,
        slug=body.slug,
        industry=body.industry,
        size_range=body.size_range,
        billing_email=body.billing_email,
        admin_user_id=current_user.id,
    )
    db.add(org)
    await db.flush()

    perm = Permission(
        id=str(uuid.uuid4()),
        actor_id=current_user.id,
        resource_type="org",
        resource_id=org.id,
        role="admin",
        granted_by=current_user.id,
    )
    db.add(perm)

    user = (await db.execute(select(User).where(User.id == current_user.id))).scalar_one()
    user.org_id = org.id
    user.account_type = "org"

    await db.commit()
    await db.refresh(org)
    return {
        "id": org.id, "name": org.name, "slug": org.slug,
        "admin_user_id": org.admin_user_id, "created_at": org.created_at.isoformat(),
    }


@router.get("/{slug}")
async def get_org(slug: str, current_user: CurrentUser, db: DB):
    """Get org detail. Caller must be a member."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")
    return {
        "id": org.id, "name": org.name, "slug": org.slug,
        "logo_url": org.logo_url, "industry": org.industry,
        "size_range": org.size_range, "custom_domain": org.custom_domain,
        "brand_colors": org.brand_colors, "billing_email": org.billing_email,
        "admin_user_id": org.admin_user_id, "is_active": org.is_active,
        "created_at": org.created_at.isoformat(), "updated_at": org.updated_at.isoformat(),
    }


@router.patch("/{slug}")
async def update_org(slug: str, body: OrgUpdate, current_user: CurrentUser, db: DB):
    """Update org settings. Admin only."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return {"id": org.id, "name": org.name, "slug": org.slug, "updated_at": org.updated_at.isoformat()}


# ── member management ──────────────────────────────────────────────────────────

@router.get("/{slug}/members")
async def list_members(slug: str, current_user: CurrentUser, db: DB):
    """List all org members with their roles and last_active."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    perms = (await db.execute(
        select(Permission).where(
            Permission.resource_type == "org",
            Permission.resource_id == org.id,
        )
    )).scalars().all()

    user_ids = [p.actor_id for p in perms]
    users_map = {u.id: u for u in (await db.execute(
        select(User).where(User.id.in_(user_ids))
    )).scalars().all()} if user_ids else {}

    cohort_counts = {}
    if user_ids:
        rows = (await db.execute(
            select(CohortMember.user_id, func.count(CohortMember.id))
            .join(Cohort, Cohort.id == CohortMember.cohort_id)
            .where(Cohort.org_id == org.id, CohortMember.user_id.in_(user_ids))
            .group_by(CohortMember.user_id)
        )).all()
        cohort_counts = {uid: int(cnt) for uid, cnt in rows}

    members = []
    for perm in perms:
        u = users_map.get(perm.actor_id)
        if not u:
            continue
        members.append({
            "user_id": u.id, "name": u.name, "email": u.email,
            "avatar_url": u.avatar_url, "role": perm.role,
            "cohort_count": cohort_counts.get(u.id, 0),
            "is_active": u.is_active,
            "joined_at": perm.created_at.isoformat(),
        })
    return {"members": members, "total": len(members)}


@router.post("/{slug}/members/invite")
async def invite_member(slug: str, body: MemberInvite, current_user: CurrentUser, db: DB):
    """Invite a single user by email, granting them a Permission row."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    user = (await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    existing = await get_permission(db, user.id, "org", org.id)
    if existing:
        raise HTTPException(status_code=409, detail="already_a_member")

    perm = Permission(
        id=str(uuid.uuid4()),
        actor_id=user.id,
        resource_type="org",
        resource_id=org.id,
        role=body.role,
        granted_by=current_user.id,
    )
    db.add(perm)
    await db.commit()

    try:
        from app.services.notification_service import _save_in_app
        await _save_in_app(
            db, [user], "org_invite",
            f"You joined {org.name}",
            f"You have been added to {org.name} as {body.role}.",
            link=f"/{org.slug}/dashboard",
        )
    except Exception as exc:
        logger.warning("Invite notification failed: %s", exc)

    return {"user_id": user.id, "role": body.role, "org_id": org.id}


@router.post("/{slug}/members/bulk-invite")
async def bulk_invite(slug: str, body: BulkInvite, current_user: CurrentUser, db: DB):
    """Invite multiple users by email list. Fires notification tasks for each."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    users = (await db.execute(
        select(User).where(User.email.in_(body.emails), User.is_active == True)
    )).scalars().all()

    invited, skipped = [], []
    for user in users:
        existing = await get_permission(db, user.id, "org", org.id)
        if existing:
            skipped.append(user.email)
            continue
        perm = Permission(
            id=str(uuid.uuid4()),
            actor_id=user.id,
            resource_type="org",
            resource_id=org.id,
            role=body.role,
            granted_by=current_user.id,
        )
        db.add(perm)
        invited.append(user)

    await db.commit()

    try:
        from app.services.notification_service import _save_in_app, _dispatch_email
        if invited:
            await _save_in_app(
                db, invited, "org_invite",
                f"You joined {org.name}",
                f"You have been added to {org.name} as {body.role}.",
                link=f"/{org.slug}/dashboard",
            )
            html = (
                f"<p>You have been invited to join <strong>{org.name}</strong> "
                f"on StudyForge as <strong>{body.role}</strong>.</p>"
            )
            _dispatch_email(invited, f"[StudyForge] You joined {org.name}", html)
    except Exception as exc:
        logger.warning("Bulk invite notification failed: %s", exc)

    return {
        "invited": [u.email for u in invited],
        "skipped": skipped,
        "not_found": [e for e in body.emails if e not in {u.email for u in users}],
    }


@router.delete("/{slug}/members/{user_id}", status_code=204)
async def remove_member(slug: str, user_id: str, current_user: CurrentUser, db: DB):
    """Remove a member — revokes all org-level permissions."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    if user_id == org.admin_user_id:
        raise HTTPException(status_code=400, detail="cannot_remove_org_admin")

    perm = await get_permission(db, user_id, "org", org.id)
    if not perm:
        raise HTTPException(status_code=404, detail="member_not_found")

    await db.delete(perm)

    cohort_memberships = (await db.execute(
        select(CohortMember)
        .join(Cohort, Cohort.id == CohortMember.cohort_id)
        .where(Cohort.org_id == org.id, CohortMember.user_id == user_id)
    )).scalars().all()
    for cm in cohort_memberships:
        await db.delete(cm)

    await db.commit()
    return None


@router.patch("/{slug}/members/{user_id}/role")
async def update_member_role(slug: str, user_id: str, body: MemberRoleUpdate, current_user: CurrentUser, db: DB):
    """Change a member's org role."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    perm = await get_permission(db, user_id, "org", org.id)
    if not perm:
        raise HTTPException(status_code=404, detail="member_not_found")

    perm.role = body.role
    await db.commit()
    return {"user_id": user_id, "role": body.role}


# ── cohort management ──────────────────────────────────────────────────────────

@router.get("/{slug}/cohorts")
async def list_cohorts(slug: str, current_user: CurrentUser, db: DB):
    """List cohorts with member_count and assignment_count."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    cohorts = (await db.execute(
        select(Cohort).where(Cohort.org_id == org.id).order_by(Cohort.created_at.desc())
    )).scalars().all()

    cohort_ids = [c.id for c in cohorts]
    member_counts, assign_counts = {}, {}
    if cohort_ids:
        for cid, cnt in (await db.execute(
            select(CohortMember.cohort_id, func.count(CohortMember.id))
            .where(CohortMember.cohort_id.in_(cohort_ids))
            .group_by(CohortMember.cohort_id)
        )).all():
            member_counts[cid] = int(cnt)
        for cid, cnt in (await db.execute(
            select(Assignment.cohort_id, func.count(Assignment.id))
            .where(Assignment.cohort_id.in_(cohort_ids))
            .group_by(Assignment.cohort_id)
        )).all():
            assign_counts[cid] = int(cnt)

    return {
        "cohorts": [
            {
                "id": c.id, "name": c.name, "subject": c.subject,
                "start_date": c.start_date.isoformat() if c.start_date else None,
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "is_archived": c.is_archived,
                "member_count": member_counts.get(c.id, 0),
                "assignment_count": assign_counts.get(c.id, 0),
                "created_at": c.created_at.isoformat(),
            }
            for c in cohorts
        ]
    }


@router.post("/{slug}/cohorts")
async def create_cohort(slug: str, body: CohortCreate, current_user: CurrentUser, db: DB):
    """Create a cohort. Requires admin or teacher role."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    from datetime import date as _date
    cohort = Cohort(
        id=str(uuid.uuid4()),
        org_id=org.id,
        name=body.name,
        description=body.description,
        subject=body.subject,
        start_date=_date.fromisoformat(body.start_date) if body.start_date else None,
        end_date=_date.fromisoformat(body.end_date) if body.end_date else None,
        created_by=current_user.id,
    )
    db.add(cohort)
    await db.commit()
    await db.refresh(cohort)
    return {"id": cohort.id, "name": cohort.name, "org_id": cohort.org_id, "created_at": cohort.created_at.isoformat()}


@router.get("/{slug}/cohorts/{cohort_id}")
async def get_cohort(slug: str, cohort_id: str, current_user: CurrentUser, db: DB):
    """Cohort detail with teacher and student lists."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    cohort = (await db.execute(
        select(Cohort).where(Cohort.id == cohort_id, Cohort.org_id == org.id)
    )).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="cohort_not_found")

    members_rows = (await db.execute(
        select(CohortMember, User)
        .join(User, User.id == CohortMember.user_id)
        .where(CohortMember.cohort_id == cohort_id)
    )).all()

    teachers = [
        {"user_id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url}
        for cm, u in members_rows if cm.role == "teacher"
    ]
    students = [
        {"user_id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url, "joined_at": cm.joined_at.isoformat()}
        for cm, u in members_rows if cm.role == "student"
    ]

    return {
        "id": cohort.id, "name": cohort.name, "description": cohort.description,
        "subject": cohort.subject,
        "start_date": cohort.start_date.isoformat() if cohort.start_date else None,
        "end_date": cohort.end_date.isoformat() if cohort.end_date else None,
        "is_archived": cohort.is_archived,
        "teachers": teachers, "students": students,
        "created_at": cohort.created_at.isoformat(),
    }


@router.patch("/{slug}/cohorts/{cohort_id}")
async def update_cohort(slug: str, cohort_id: str, body: CohortUpdate, current_user: CurrentUser, db: DB):
    """Update cohort fields. Teacher or admin."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    cohort = (await db.execute(
        select(Cohort).where(Cohort.id == cohort_id, Cohort.org_id == org.id)
    )).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="cohort_not_found")

    from datetime import date as _date
    for field, value in body.model_dump(exclude_none=True).items():
        if field in ("start_date", "end_date") and value:
            value = _date.fromisoformat(value)
        setattr(cohort, field, value)

    await db.commit()
    return {"id": cohort.id, "name": cohort.name, "is_archived": cohort.is_archived}


@router.post("/{slug}/cohorts/{cohort_id}/members")
async def add_cohort_member(slug: str, cohort_id: str, body: CohortMemberAdd, current_user: CurrentUser, db: DB):
    """Add a user to a cohort with a role."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    cohort = (await db.execute(
        select(Cohort).where(Cohort.id == cohort_id, Cohort.org_id == org.id)
    )).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="cohort_not_found")

    existing = (await db.execute(
        select(CohortMember).where(
            CohortMember.cohort_id == cohort_id, CohortMember.user_id == body.user_id
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="already_a_cohort_member")

    cm = CohortMember(
        id=str(uuid.uuid4()),
        cohort_id=cohort_id,
        user_id=body.user_id,
        role=body.role,
    )
    db.add(cm)
    await db.commit()
    return {"cohort_id": cohort_id, "user_id": body.user_id, "role": body.role}


@router.delete("/{slug}/cohorts/{cohort_id}/members/{user_id}", status_code=204)
async def remove_cohort_member(slug: str, cohort_id: str, user_id: str, current_user: CurrentUser, db: DB):
    """Remove a user from a cohort."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    cm = (await db.execute(
        select(CohortMember).where(
            CohortMember.cohort_id == cohort_id, CohortMember.user_id == user_id
        )
    )).scalar_one_or_none()
    if not cm:
        raise HTTPException(status_code=404, detail="member_not_found")

    await db.delete(cm)
    await db.commit()
    return None


# ── assignments ────────────────────────────────────────────────────────────────

@router.post("/{slug}/cohorts/{cohort_id}/assignments")
async def create_assignment(slug: str, cohort_id: str, body: AssignmentCreate, current_user: CurrentUser, db: DB):
    """Create an assignment for a cohort. Teacher or admin."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    cohort = (await db.execute(
        select(Cohort).where(Cohort.id == cohort_id, Cohort.org_id == org.id)
    )).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="cohort_not_found")

    assignment = Assignment(
        id=str(uuid.uuid4()),
        cohort_id=cohort_id,
        creator_id=current_user.id,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        title=body.title,
        due_at=datetime.fromisoformat(body.due_at) if body.due_at else None,
        instructions=body.instructions,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {
        "id": assignment.id, "title": assignment.title,
        "cohort_id": assignment.cohort_id, "resource_type": assignment.resource_type,
        "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
        "created_at": assignment.created_at.isoformat(),
    }


@router.get("/{slug}/cohorts/{cohort_id}/assignments")
async def list_assignments(slug: str, cohort_id: str, current_user: CurrentUser, db: DB):
    """List assignments for a cohort."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    assignments = (await db.execute(
        select(Assignment).where(Assignment.cohort_id == cohort_id)
        .order_by(Assignment.created_at.desc())
    )).scalars().all()

    return {
        "assignments": [
            {
                "id": a.id, "title": a.title, "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "due_at": a.due_at.isoformat() if a.due_at else None,
                "instructions": a.instructions, "created_at": a.created_at.isoformat(),
            }
            for a in assignments
        ]
    }


@router.get("/{slug}/assignments/{assignment_id}/progress")
async def get_assignment_progress(slug: str, assignment_id: str, current_user: CurrentUser, db: DB):
    """Per-student progress grid for an assignment. Teacher or admin."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    assignment = (await db.execute(
        select(Assignment).where(Assignment.id == assignment_id)
    )).scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="assignment_not_found")

    students = (await db.execute(
        select(CohortMember, User)
        .join(User, User.id == CohortMember.user_id)
        .where(CohortMember.cohort_id == assignment.cohort_id, CohortMember.role == "student")
    )).all()

    progress_map = {
        ap.user_id: ap
        for ap in (await db.execute(
            select(AssignmentProgress).where(AssignmentProgress.assignment_id == assignment_id)
        )).scalars().all()
    }

    grid = []
    for cm, user in students:
        ap = progress_map.get(user.id)
        grid.append({
            "user_id": user.id, "name": user.name, "email": user.email,
            "status": ap.status if ap else "not_started",
            "score": ap.score if ap else None,
            "submitted_at": ap.submitted_at.isoformat() if ap and ap.submitted_at else None,
            "feedback": ap.feedback if ap else None,
        })

    return {"assignment_id": assignment_id, "title": assignment.title, "students": grid}


# ── KPI endpoints ──────────────────────────────────────────────────────────────

def _kpi_or_cache(cache_rows: list, key: str, fallback=None):
    for row in cache_rows:
        if row.metric_key == key:
            return row.metric_value
    return fallback


@router.get("/{slug}/kpis/overview")
async def kpi_overview(slug: str, current_user: CurrentUser, db: DB):
    """Org KPI overview: dau, wau, avg_exam_score, completion_rate, at_risk_count."""
    from datetime import date, timedelta
    from sqlalchemy import text as sa_text

    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    today = date.today()
    cache = (await db.execute(
        select(KpiCache).where(
            KpiCache.scope_type == "org",
            KpiCache.scope_id == org.id,
            KpiCache.date == today,
        )
    )).scalars().all()

    if cache:
        return {
            "dau": _kpi_or_cache(cache, "dau", 0),
            "wau": _kpi_or_cache(cache, "wau", 0),
            "avg_exam_score": _kpi_or_cache(cache, "avg_exam_score"),
            "completion_rate": _kpi_or_cache(cache, "completion_rate"),
            "at_risk_count": int(_kpi_or_cache(cache, "at_risk_count", 0) or 0),
        }

    # Live fallback
    try:
        now_utc = datetime.now(timezone.utc)
        day_ago = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = now_utc - __import__("datetime").timedelta(days=7)

        dau_row = await db.execute(sa_text(
            "SELECT COUNT(DISTINCT user_id) FROM user_events "
            "WHERE org_id = :org_id AND time >= :since"
        ), {"org_id": org.id, "since": day_ago})
        dau = int(dau_row.scalar() or 0)

        wau_row = await db.execute(sa_text(
            "SELECT COUNT(DISTINCT user_id) FROM user_events "
            "WHERE org_id = :org_id AND time >= :since"
        ), {"org_id": org.id, "since": week_ago})
        wau = int(wau_row.scalar() or 0)

        score_row = await db.execute(sa_text(
            "SELECT AVG((metadata->>'score')::float) FROM user_events "
            "WHERE org_id = :org_id AND event_type = 'exam.submitted' "
            "AND time >= NOW() - INTERVAL '30 days'"
        ), {"org_id": org.id})
        avg_score = score_row.scalar()

        at_risk_row = await db.execute(sa_text(
            "SELECT COUNT(DISTINCT user_id) FROM user_events WHERE org_id = :org_id "
            "AND time >= NOW() - INTERVAL '7 days'"
        ), {"org_id": org.id})
        active_last_week = int(at_risk_row.scalar() or 0)

        total_members = int((await db.execute(sa_text(
            "SELECT COUNT(*) FROM permissions "
            "WHERE resource_type = 'org' AND resource_id = :org_id"
        ), {"org_id": org.id})).scalar() or 0)
        at_risk_count = max(0, total_members - active_last_week)

    except Exception as exc:
        logger.warning("Live KPI query failed for org %s: %s", org.id, exc)
        dau, wau, avg_score, at_risk_count = 0, 0, None, 0

    return {
        "dau": dau, "wau": wau,
        "avg_exam_score": round(avg_score, 4) if avg_score is not None else None,
        "completion_rate": None,
        "at_risk_count": at_risk_count,
    }


@router.get("/{slug}/kpis/cohorts")
async def kpi_cohorts(slug: str, current_user: CurrentUser, db: DB):
    """Per-cohort KPI summary list."""
    from datetime import date
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    cohorts = (await db.execute(
        select(Cohort).where(Cohort.org_id == org.id, Cohort.is_archived == False)
    )).scalars().all()

    today = date.today()
    result = []
    for c in cohorts:
        cache = (await db.execute(
            select(KpiCache).where(
                KpiCache.scope_type == "cohort",
                KpiCache.scope_id == c.id,
                KpiCache.date == today,
            )
        )).scalars().all()

        member_count = int((await db.execute(
            select(func.count(CohortMember.id)).where(CohortMember.cohort_id == c.id)
        )).scalar() or 0)

        result.append({
            "cohort_id": c.id, "name": c.name, "subject": c.subject,
            "member_count": member_count,
            "avg_exam_score": _kpi_or_cache(cache, "avg_exam_score"),
            "completion_rate": _kpi_or_cache(cache, "completion_rate"),
            "dau": _kpi_or_cache(cache, "dau", 0),
        })

    return {"cohorts": result}


@router.get("/{slug}/cohorts/{cohort_id}/kpis")
async def kpi_cohort_detail(slug: str, cohort_id: str, current_user: CurrentUser, db: DB):
    """Full KPI breakdown for a single cohort."""
    from datetime import date
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    cohort = (await db.execute(
        select(Cohort).where(Cohort.id == cohort_id, Cohort.org_id == org.id)
    )).scalar_one_or_none()
    if not cohort:
        raise HTTPException(status_code=404, detail="cohort_not_found")

    today = date.today()
    cache = (await db.execute(
        select(KpiCache).where(
            KpiCache.scope_type == "cohort",
            KpiCache.scope_id == cohort_id,
            KpiCache.date == today,
        )
    )).scalars().all()

    return {
        "cohort_id": cohort_id, "name": cohort.name,
        "dau": _kpi_or_cache(cache, "dau", 0),
        "wau": _kpi_or_cache(cache, "wau", 0),
        "avg_exam_score": _kpi_or_cache(cache, "avg_exam_score"),
        "completion_rate": _kpi_or_cache(cache, "completion_rate"),
        "at_risk_count": int(_kpi_or_cache(cache, "at_risk_count", 0) or 0),
        "flashcard_retention": _kpi_or_cache(cache, "flashcard_retention"),
    }


@router.get("/{slug}/kpis/at-risk")
async def at_risk_students(slug: str, current_user: CurrentUser, db: DB):
    """List at-risk students with reason flags."""
    from sqlalchemy import text as sa_text
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    try:
        rows = (await db.execute(sa_text(
            """
            SELECT u.id, u.name, u.email, u.avatar_url,
                   MAX(ue.time) AS last_event,
                   COUNT(ue.user_id) AS event_count_7d
            FROM permissions p
            JOIN users u ON u.id = p.actor_id
            LEFT JOIN user_events ue
                ON ue.user_id = u.id
                AND ue.org_id = :org_id
                AND ue.time >= NOW() - INTERVAL '7 days'
            WHERE p.resource_type = 'org'
              AND p.resource_id = :org_id
              AND p.role IN ('student', 'teacher')
            GROUP BY u.id, u.name, u.email, u.avatar_url
            HAVING MAX(ue.time) IS NULL OR MAX(ue.time) < NOW() - INTERVAL '7 days'
            ORDER BY last_event ASC NULLS FIRST
            LIMIT 50
            """
        ), {"org_id": org.id})).all()

        students = [
            {
                "user_id": row[0], "name": row[1], "email": row[2], "avatar_url": row[3],
                "last_active": row[4].isoformat() if row[4] else None,
                "reason_flags": ["no_activity_7d"] + (["low_exam_score"] if row[5] == 0 else []),
            }
            for row in rows
        ]
    except Exception as exc:
        logger.warning("at-risk query failed: %s", exc)
        students = []

    return {"at_risk": students, "total": len(students)}


@router.get("/{slug}/billing")
async def get_org_billing(slug: str, current_user: CurrentUser, db: DB):
    """Org subscription/billing status — reads from Subscription table."""
    from app.models.notification import Subscription

    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "admin")

    # Look for a subscription tied to the org owner or the org's school_id
    sub = (await db.execute(
        select(Subscription).where(
            Subscription.school_id == org.id,
        ).order_by(Subscription.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    # Fallback: look up by the org's customer_id
    if sub is None and org.stripe_customer_id:
        sub = (await db.execute(
            select(Subscription).where(
                Subscription.stripe_customer_id == org.stripe_customer_id,
            ).order_by(Subscription.created_at.desc()).limit(1)
        )).scalar_one_or_none()

    if sub:
        return {
            "plan": sub.plan,
            "status": sub.status,
            "current_period_end": sub.period_end.isoformat() if sub.period_end else None,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "customer_id": sub.stripe_customer_id or org.stripe_customer_id,
        }

    return {
        "plan": "free",
        "status": "active",
        "current_period_end": None,
        "cancel_at_period_end": False,
        "customer_id": org.stripe_customer_id,
    }


@router.get("/{slug}/students/{user_id}")
async def get_student_profile(slug: str, user_id: str, current_user: CurrentUser, db: DB):
    """Student profile: basic info, cohort, last active, exam score trend, weak areas."""
    from sqlalchemy import text as sa_text
    from app.models.exam import ExamSession

    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Cohort membership
    cohort_row = (await db.execute(
        select(CohortMember, Cohort)
        .join(Cohort, Cohort.id == CohortMember.cohort_id)
        .where(
            CohortMember.user_id == user_id,
            Cohort.org_id == org.id,
        )
        .order_by(CohortMember.joined_at.desc())
        .limit(1)
    )).first()
    cohort_name = cohort_row[1].name if cohort_row else None

    # Last active
    last_active: str | None = None
    try:
        la_row = (await db.execute(sa_text(
            "SELECT MAX(time) FROM user_events WHERE org_id = :org_id AND user_id = :uid"
        ), {"org_id": org.id, "uid": user_id})).scalar()
        last_active = la_row.isoformat() if la_row else None
    except Exception as exc:
        logger.warning("last_active query failed: %s", exc)

    # Exam score trend (last 10 sessions, chronological)
    sessions = (await db.execute(
        select(ExamSession.score_over_20, ExamSession.submitted_at)
        .where(
            ExamSession.user_id == user_id,
            ExamSession.score_over_20.isnot(None),
        )
        .order_by(ExamSession.submitted_at.desc())
        .limit(10)
    )).all()
    exam_score_trend = [round(float(r[0]), 2) for r in reversed(sessions)]

    # Weak areas: derive from exam events (topics with lowest avg scores)
    weak_areas: list[str] = []
    try:
        wa_rows = (await db.execute(sa_text(
            """
            SELECT metadata->>'topic' AS topic, AVG((metadata->>'score')::float) AS avg
            FROM user_events
            WHERE org_id = :org_id AND user_id = :uid
              AND event_type = 'exam.submitted'
              AND metadata->>'topic' IS NOT NULL
            GROUP BY topic HAVING AVG((metadata->>'score')::float) < 12
            ORDER BY avg ASC LIMIT 5
            """
        ), {"org_id": org.id, "uid": user_id})).all()
        weak_areas = [r[0] for r in wa_rows if r[0]]
    except Exception as exc:
        logger.warning("weak_areas query failed: %s", exc)

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "cohort_name": cohort_name,
        "last_active": last_active,
        "weak_areas": weak_areas,
        "exam_score_trend": exam_score_trend,
    }


@router.get("/{slug}/students/{user_id}/timeline")
async def student_timeline(slug: str, user_id: str, current_user: CurrentUser, db: DB):
    """Chronological activity list from user_events for a specific student."""
    from sqlalchemy import text as sa_text
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    try:
        rows = (await db.execute(sa_text(
            """
            SELECT time, event_type, resource_type, resource_id, metadata
            FROM user_events
            WHERE user_id = :user_id AND org_id = :org_id
            ORDER BY time DESC
            LIMIT 100
            """
        ), {"user_id": user_id, "org_id": org.id})).all()

        events = [
            {
                "time": row[0].isoformat(),
                "event_type": row[1],
                "resource_type": row[2],
                "resource_id": row[3],
                "metadata": row[4] or {},
            }
            for row in rows
        ]
    except Exception as exc:
        logger.warning("timeline query failed: %s", exc)
        events = []

    return {"user_id": user_id, "events": events}


@router.get("/{slug}/cohorts/{cohort_id}/students")
async def list_cohort_students(slug: str, cohort_id: str, current_user: CurrentUser, db: DB):
    """Students in a cohort with lightweight analytics (last active, avg exam score, path progress)."""
    from sqlalchemy import text as sa_text
    from app.models.learning_path import LearningPathProgress

    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "teacher")

    members = (await db.execute(
        select(CohortMember, User)
        .join(User, User.id == CohortMember.user_id)
        .where(CohortMember.cohort_id == cohort_id)
        .order_by(User.name)
    )).all()

    if not members:
        return {"students": []}

    user_ids = [u.id for _, u in members]

    # Last active per user from user_events (best effort — table may not exist yet)
    last_active_map: dict[str, str | None] = {}
    try:
        rows = (await db.execute(sa_text(
            "SELECT user_id, MAX(time) AS last_active FROM user_events "
            "WHERE org_id = :org_id AND user_id = ANY(:uids) GROUP BY user_id"
        ), {"org_id": org.id, "uids": user_ids})).all()
        last_active_map = {r[0]: r[1].isoformat() if r[1] else None for r in rows}
    except Exception as exc:
        logger.warning("last_active query failed: %s", exc)

    # Avg exam score per user (score_over_20 from ExamSession, all groups)
    from app.models.exam import ExamSession
    score_rows = (await db.execute(
        select(ExamSession.user_id, func.avg(ExamSession.score_over_20))
        .where(
            ExamSession.user_id.in_(user_ids),
            ExamSession.score_over_20.isnot(None),
        )
        .group_by(ExamSession.user_id)
    )).all()
    avg_score_map = {r[0]: round(float(r[1]), 2) for r in score_rows}

    # Paths completed per user (distinct path_id with at least one module completed)
    path_rows = (await db.execute(
        select(LearningPathProgress.user_id, func.count(func.distinct(LearningPathProgress.path_id)))
        .where(LearningPathProgress.user_id.in_(user_ids))
        .group_by(LearningPathProgress.user_id)
    )).all()
    paths_map = {r[0]: int(r[1]) for r in path_rows}

    # Is at-risk: no activity in last 7 days
    at_risk_ids: set[str] = set()
    try:
        risk_rows = (await db.execute(sa_text(
            "SELECT user_id FROM user_events "
            "WHERE org_id = :org_id AND user_id = ANY(:uids) "
            "AND time >= NOW() - INTERVAL '7 days' GROUP BY user_id"
        ), {"org_id": org.id, "uids": user_ids})).all()
        active_ids = {r[0] for r in risk_rows}
        at_risk_ids = set(user_ids) - active_ids
    except Exception as exc:
        logger.warning("at_risk query failed: %s", exc)

    return {
        "students": [
            {
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "avatar_url": user.avatar_url,
                "last_active": last_active_map.get(user.id),
                "avg_exam_score": avg_score_map.get(user.id),
                "paths_completed": paths_map.get(user.id, 0),
                "paths_total": paths_map.get(user.id, 0),  # total context unavailable without org→group link
                "flashcard_retention": None,
                "is_at_risk": user.id in at_risk_ids,
            }
            for _, user in members
        ]
    }


@router.get("/{slug}/assignments/my")
async def my_assignments(slug: str, current_user: CurrentUser, db: DB):
    """Assignments visible to the current user across all cohorts they belong to in this org."""
    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    # Get cohorts this user is a member of, in this org
    cohort_ids_result = await db.execute(
        select(CohortMember.cohort_id)
        .join(Cohort, Cohort.id == CohortMember.cohort_id)
        .where(
            CohortMember.user_id == current_user.id,
            Cohort.org_id == org.id,
        )
    )
    cohort_ids = [r[0] for r in cohort_ids_result.all()]
    if not cohort_ids:
        return {"assignments": []}

    # Assignments for those cohorts
    assignments = (await db.execute(
        select(Assignment).where(Assignment.cohort_id.in_(cohort_ids)).order_by(Assignment.due_at.asc().nullslast())
    )).scalars().all()

    if not assignments:
        return {"assignments": []}

    assignment_ids = [a.id for a in assignments]

    # User's progress for each assignment
    progress_rows = (await db.execute(
        select(AssignmentProgress).where(
            AssignmentProgress.assignment_id.in_(assignment_ids),
            AssignmentProgress.user_id == current_user.id,
        )
    )).scalars().all()
    progress_map = {p.assignment_id: p for p in progress_rows}

    return {
        "assignments": [
            {
                "id": a.id,
                "title": a.title,
                "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "group_id": "",  # no group on assignment; cohort_id used instead
                "due_at": a.due_at.isoformat() if a.due_at else None,
                "instructions": a.instructions,
                "progress": (
                    {
                        "status": progress_map[a.id].status,
                        "score_over_20": progress_map[a.id].score,
                    }
                    if a.id in progress_map
                    else {"status": "not_started", "score_over_20": None}
                ),
            }
            for a in assignments
        ]
    }


@router.get("/{slug}/kpis/dau-trend")
async def dau_trend(slug: str, current_user: CurrentUser, db: DB):
    """Daily active users for the past 30 days."""
    from sqlalchemy import text as sa_text

    org = await _get_org_by_slug(slug, db)
    await _require_org_role(db, current_user.id, org.id, "viewer")

    try:
        rows = (await db.execute(sa_text(
            """
            SELECT DATE(time AT TIME ZONE 'UTC') AS day, COUNT(DISTINCT user_id) AS cnt
            FROM user_events
            WHERE org_id = :org_id AND time >= NOW() - INTERVAL '30 days'
            GROUP BY day ORDER BY day
            """
        ), {"org_id": org.id})).all()
        trend = [{"date": row[0].isoformat(), "count": int(row[1])} for row in rows]
    except Exception as exc:
        logger.warning("dau_trend query failed for org %s: %s", org.id, exc)
        trend = []

    return {"trend": trend}
