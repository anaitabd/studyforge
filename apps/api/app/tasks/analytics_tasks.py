import logging
from datetime import date, datetime, timedelta, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(queue="analytics", name="app.tasks.analytics_tasks.compute_org_kpis")
def compute_org_kpis(org_id: str) -> dict:
    """
    Nightly task. Computes KPIs for all cohorts and users in an org
    and writes rows to kpi_cache for fast dashboard reads.
    """
    import asyncio
    return asyncio.get_event_loop().run_until_complete(_async_compute_org_kpis(org_id))


async def _async_compute_org_kpis(org_id: str) -> dict:
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal
    from app.models.cohort import Cohort, CohortMember
    from app.models.goal import KpiCache

    today = date.today()
    written = 0

    async with AsyncSessionLocal() as db:
        try:
            from sqlalchemy import select
            cohorts = (await db.execute(
                select(Cohort).where(Cohort.org_id == org_id, Cohort.is_archived == False)
            )).scalars().all()

            # Org-level KPIs
            now_utc = datetime.now(timezone.utc)
            day_ago = now_utc - timedelta(hours=24)
            week_ago = now_utc - timedelta(days=7)
            month_ago = now_utc - timedelta(days=30)

            dau = int((await db.execute(text(
                "SELECT COUNT(DISTINCT user_id) FROM user_events "
                "WHERE org_id = :org_id AND time >= :since"
            ), {"org_id": org_id, "since": day_ago})).scalar() or 0)

            wau = int((await db.execute(text(
                "SELECT COUNT(DISTINCT user_id) FROM user_events "
                "WHERE org_id = :org_id AND time >= :since"
            ), {"org_id": org_id, "since": week_ago})).scalar() or 0)

            avg_score = (await db.execute(text(
                "SELECT AVG((metadata->>'score')::float) FROM user_events "
                "WHERE org_id = :org_id AND event_type = 'exam.submitted' AND time >= :since"
            ), {"org_id": org_id, "since": month_ago})).scalar()

            total_members = int((await db.execute(text(
                "SELECT COUNT(*) FROM permissions "
                "WHERE resource_type = 'org' AND resource_id = :org_id"
            ), {"org_id": org_id})).scalar() or 0)

            active_7d = int((await db.execute(text(
                "SELECT COUNT(DISTINCT user_id) FROM user_events "
                "WHERE org_id = :org_id AND time >= :since"
            ), {"org_id": org_id, "since": week_ago})).scalar() or 0)

            at_risk = max(0, total_members - active_7d)

            for key, val in [("dau", dau), ("wau", wau), ("avg_exam_score", avg_score), ("at_risk_count", at_risk)]:
                await _upsert_kpi(db, "org", org_id, key, val, today)
                written += 1

            # Per-cohort KPIs
            for cohort in cohorts:
                student_ids_rows = (await db.execute(
                    select(CohortMember.user_id).where(
                        CohortMember.cohort_id == cohort.id, CohortMember.role == "student"
                    )
                )).scalars().all()
                student_ids = list(student_ids_rows)
                if not student_ids:
                    continue

                cohort_dau = int((await db.execute(text(
                    "SELECT COUNT(DISTINCT user_id) FROM user_events "
                    "WHERE user_id = ANY(:ids) AND time >= :since"
                ), {"ids": student_ids, "since": day_ago})).scalar() or 0)

                cohort_score = (await db.execute(text(
                    "SELECT AVG((metadata->>'score')::float) FROM user_events "
                    "WHERE user_id = ANY(:ids) AND event_type = 'exam.submitted' AND time >= :since"
                ), {"ids": student_ids, "since": month_ago})).scalar()

                cohort_at_risk = sum(1 for uid in student_ids if uid not in (
                    set((await db.execute(text(
                        "SELECT DISTINCT user_id FROM user_events "
                        "WHERE user_id = ANY(:ids) AND time >= :since"
                    ), {"ids": student_ids, "since": week_ago})).scalars().all())
                ))

                for key, val in [("dau", cohort_dau), ("avg_exam_score", cohort_score), ("at_risk_count", cohort_at_risk)]:
                    await _upsert_kpi(db, "cohort", cohort.id, key, val, today)
                    written += 1

            await db.commit()
            logger.info("compute_org_kpis org=%s written=%d rows", org_id, written)
        except Exception as exc:
            logger.exception("compute_org_kpis failed for org %s: %s", org_id, exc)
            await db.rollback()

    return {"org_id": org_id, "written": written}


async def _upsert_kpi(db, scope_type, scope_id, metric_key, metric_value, today):
    from sqlalchemy import text
    await db.execute(text("""
        INSERT INTO kpi_cache (id, scope_type, scope_id, metric_key, metric_value, computed_at, date)
        VALUES (gen_random_uuid()::text, :scope_type, :scope_id, :key, :val, NOW(), :date)
        ON CONFLICT (scope_type, scope_id, metric_key, date)
        DO UPDATE SET metric_value = EXCLUDED.metric_value, computed_at = NOW()
    """), {
        "scope_type": scope_type, "scope_id": scope_id,
        "key": metric_key, "val": metric_value, "date": today,
    })


@celery_app.task(queue="analytics", name="app.tasks.analytics_tasks.update_streak_records")
def update_streak_records() -> dict:
    """
    Nightly at 23:55 UTC. Inserts streak_records rows for every user
    that had any event today.
    """
    import asyncio
    return asyncio.get_event_loop().run_until_complete(_async_update_streaks())


async def _async_update_streaks() -> dict:
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal

    today = date.today()
    inserted = 0

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(text("""
                INSERT INTO streak_records (user_id, date, has_activity)
                SELECT DISTINCT user_id, :today, TRUE
                FROM user_events
                WHERE time >= :day_start AND time < :day_end
                ON CONFLICT (user_id, date) DO NOTHING
            """), {
                "today": today,
                "day_start": datetime(today.year, today.month, today.day, tzinfo=timezone.utc),
                "day_end": datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc),
            })
            inserted = result.rowcount or 0
            await db.commit()
            logger.info("update_streak_records inserted=%d rows for %s", inserted, today)
        except Exception as exc:
            logger.exception("update_streak_records failed: %s", exc)
            await db.rollback()

    return {"date": str(today), "inserted": inserted}


@celery_app.task(queue="analytics", name="app.tasks.analytics_tasks.flag_at_risk_students")
def flag_at_risk_students() -> dict:
    """
    Daily at 06:00 UTC. Flags at-risk students in kpi_cache and sends
    a notification to org admins.
    """
    import asyncio
    return asyncio.get_event_loop().run_until_complete(_async_flag_at_risk())


async def _async_flag_at_risk() -> dict:
    from sqlalchemy import text, select
    from app.core.database import AsyncSessionLocal
    from app.models.organization import Organization
    from app.models.permissions import Permission
    from app.models.user import User

    flagged_total = 0
    today = date.today()

    async with AsyncSessionLocal() as db:
        try:
            orgs = (await db.execute(
                select(Organization).where(Organization.is_active == True)
            )).scalars().all()

            for org in orgs:
                at_risk_rows = (await db.execute(text("""
                    SELECT p.actor_id
                    FROM permissions p
                    WHERE p.resource_type = 'org'
                      AND p.resource_id = :org_id
                      AND p.role = 'student'
                      AND p.actor_id NOT IN (
                          SELECT DISTINCT user_id FROM user_events
                          WHERE org_id = :org_id
                            AND time >= NOW() - INTERVAL '7 days'
                      )
                """), {"org_id": org.id})).scalars().all()

                at_risk_count = len(at_risk_rows)
                await _upsert_kpi(db, "org", org.id, "at_risk_count", at_risk_count, today)
                flagged_total += at_risk_count

                if at_risk_count > 0:
                    admins = (await db.execute(
                        select(User)
                        .join(Permission, Permission.actor_id == User.id)
                        .where(
                            Permission.resource_type == "org",
                            Permission.resource_id == org.id,
                            Permission.role == "admin",
                            User.is_active == True,
                        )
                    )).scalars().all()

                    from app.services.notification_service import _save_in_app
                    if admins:
                        await _save_in_app(
                            db, admins, "at_risk_alert",
                            f"At-risk students in {org.name}",
                            f"{at_risk_count} student(s) had no activity in the last 7 days.",
                            link=f"/{org.slug}/kpis/at-risk",
                        )

            await db.commit()
            logger.info("flag_at_risk_students flagged=%d total", flagged_total)
        except Exception as exc:
            logger.exception("flag_at_risk_students failed: %s", exc)
            await db.rollback()

    return {"flagged": flagged_total}
