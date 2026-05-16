import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import GroupMember
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)


async def _get_group_members(
    db: AsyncSession,
    group_id: str,
    exclude_user_id: str | None = None,
) -> list[User]:
    """Return all active users in a group, optionally excluding one."""
    members_result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id)
    )
    memberships = members_result.scalars().all()
    user_ids = [
        m.user_id for m in memberships
        if m.user_id != exclude_user_id
    ]
    if not user_ids:
        return []

    users_result = await db.execute(
        select(User).where(User.id.in_(user_ids), User.is_active == True)
    )
    return users_result.scalars().all()


async def _save_in_app(
    db: AsyncSession,
    users: list[User],
    notif_type: str,
    title: str,
    body: str,
    link: str | None = None,
) -> None:
    """Persist an in-app Notification row for each user."""
    for user in users:
        db.add(Notification(
            id=str(uuid.uuid4()),
            user_id=user.id,
            type=notif_type,
            title=title,
            body=body,
            link=link,
        ))
    await db.commit()


def _dispatch_email(users: list[User], subject: str, html_body: str, idempotency_prefix: str = "") -> None:
    """Fire send_email_task for users who have an email address AND have notif_email enabled."""
    from app.tasks.notification_tasks import send_email_task

    for user in users:
        if user.email and getattr(user, "notif_email", True):
            try:
                send_email_task.delay(
                    to_email=user.email,
                    subject=subject,
                    html_body=html_body,
                    idempotency_key=f"{idempotency_prefix}:{user.id}" if idempotency_prefix else None,
                )
            except Exception as e:
                logger.warning(f"Could not queue email for {user.email}: {e}")


def _dispatch_whatsapp(users: list[User], message: str) -> None:
    """Fire send_whatsapp_task only for school-plan users who opted in to WhatsApp notifications."""
    from app.tasks.notification_tasks import send_whatsapp_task

    for user in users:
        if user.wa_number and getattr(user, "notif_whatsapp", False) and getattr(user, "plan", "") == "school":
            try:
                send_whatsapp_task.delay(
                    to_number=user.wa_number,
                    body=message,
                )
            except Exception as e:
                logger.warning(f"Could not queue WhatsApp for {user.wa_number}: {e}")


# ── public triggers ───────────────────────────────────────────────────────────

async def notify_file_ready(
    db: AsyncSession,
    group_id: str,
    file_id: str,
    file_name: str,
    uploader_id: str,
    idempotency_key: str | None = None,
) -> None:
    """
    Notify all group members (except the uploader) that a new file is ready.
    Fires in-app notification + email + WhatsApp for school users.
    """
    users = await _get_group_members(db, group_id, exclude_user_id=uploader_id)
    if not users:
        return

    title = "New file available"
    body = f'"{file_name}" has been added to your group and is ready to study.'
    link = f"/groups/{group_id}/files/{file_id}"

    if idempotency_key:
        existing = await db.execute(
            select(Notification).where(Notification.type == "file_ready", Notification.link == link)
        )
        if existing.scalar_one_or_none():
            logger.info("File-ready notification already exists; skipping")
            return

    await _save_in_app(db, users, "file_ready", title, body, link)

    subject = f"[StudyForge] New file: {file_name}"
    html = (
        f"<p>A new file <strong>{file_name}</strong> has been added to your group.</p>"
        f'<p><a href="{{frontend_url}}{link}">View file</a></p>'
    )
    _dispatch_email(users, subject, html, idempotency_prefix=idempotency_key or "")
    _dispatch_whatsapp(users, f"[StudyForge] New file in your group: {file_name}")

    logger.info(f"File-ready notifications sent to {len(users)} users for file {file_id}")


async def notify_exam_assigned(
    db: AsyncSession,
    group_id: str,
    exam_id: str,
    exam_title: str,
    teacher_name: str,
    ends_at_str: str | None,
) -> None:
    """
    Notify all students in a group that a new exam has been assigned.
    """
    users = await _get_group_members(db, group_id)
    # Only notify students
    students = [u for u in users if u.role in ("student",)]
    if not students:
        # Fall back to all members if no explicit students (personal mode groups)
        students = users
    if not students:
        return

    deadline_str = f" — deadline: {ends_at_str}" if ends_at_str else ""
    title = f"New exam: {exam_title}"
    body = f"{teacher_name} assigned a new exam: {exam_title}{deadline_str}."
    link = f"/groups/{group_id}/exams/{exam_id}"

    await _save_in_app(db, students, "exam_assigned", title, body, link)

    subject = f"[StudyForge] New exam: {exam_title}"
    html = (
        f"<p><strong>{teacher_name}</strong> assigned a new exam: "
        f"<strong>{exam_title}</strong>{deadline_str}.</p>"
        f'<p><a href="{{frontend_url}}{link}">Start exam</a></p>'
    )
    _dispatch_email(students, subject, html)
    _dispatch_whatsapp(
        students,
        f"[StudyForge] New exam: {exam_title}{deadline_str}. Start now.",
    )

    logger.info(
        f"Exam-assigned notifications sent to {len(students)} students for exam {exam_id}"
    )


async def notify_exam_deadline(
    db: AsyncSession,
    group_id: str,
    exam_id: str,
    exam_title: str,
    hours_until: int,
) -> None:
    """
    Remind students who haven't yet submitted that the deadline is approaching.
    hours_until: 24 or 2
    """
    from app.models.exam import ExamSession

    users = await _get_group_members(db, group_id)
    students = [u for u in users if u.role == "student"] or users
    if not students:
        return

    # Exclude students who already submitted
    submitted_result = await db.execute(
        select(ExamSession.user_id).where(
            ExamSession.exam_id == exam_id,
            ExamSession.submitted_at.is_not(None),
        )
    )
    submitted_ids = {row[0] for row in submitted_result.all()}
    pending = [u for u in students if u.id not in submitted_ids]
    if not pending:
        return

    notif_type = f"exam_deadline_{hours_until}h"
    # Skip if already notified
    already_result = await db.execute(
        select(Notification).where(
            Notification.type == notif_type,
            Notification.user_id.in_([u.id for u in pending]),
            Notification.link.contains(exam_id),
        )
    )
    already_notified_ids = {n.user_id for n in already_result.scalars().all()}
    to_notify = [u for u in pending if u.id not in already_notified_ids]
    if not to_notify:
        return

    title = f"Exam reminder: {exam_title}"
    body = f'"{exam_title}" closes in {hours_until} hour{"s" if hours_until > 1 else ""}.'
    link = f"/groups/{group_id}/exams/{exam_id}"

    await _save_in_app(db, to_notify, notif_type, title, body, link)

    subject = f"[StudyForge] Reminder: {exam_title} closes in {hours_until}h"
    html = (
        f"<p>Reminder: <strong>{exam_title}</strong> closes in "
        f"<strong>{hours_until} hour{'s' if hours_until > 1 else ''}</strong>.</p>"
        f'<p><a href="{{frontend_url}}{link}">Start exam now</a></p>'
    )
    _dispatch_email(to_notify, subject, html)
    _dispatch_whatsapp(
        to_notify,
        f"[StudyForge] Exam reminder: {exam_title} closes in {hours_until}h.",
    )

    logger.info(
        f"Deadline-{hours_until}h notifications sent to {len(to_notify)} students for exam {exam_id}"
    )
