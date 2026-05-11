"""
Create or promote a super_admin user for local/dev testing.

Usage (inside the api container or with DB port-forwarded to localhost):

  # Promote an existing user by email:
  python scripts/create_superadmin.py promote --email you@example.com

  # Create a brand-new stub user (no real Clerk account needed):
  python scripts/create_superadmin.py create --email admin@studyforge.dev --name "Super Admin"

Override the database URL if needed:
  DATABASE_URL=postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge \
      python scripts/create_superadmin.py promote --email you@example.com
"""

import asyncio
import sys
import os
import uuid
import argparse

# Allow running from repo root or from apps/api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, update

# ── DB URL ────────────────────────────────────────────────────────────────────
# In Docker: host=postgres  |  Port-forwarded locally: host=localhost
_DEFAULT_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://studyforge:studyforge@localhost:5432/studyforge",
)


async def _get_session(db_url: str) -> tuple[AsyncSession, any]:
    engine = create_async_engine(db_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    session = factory()
    return session, engine


# ── Commands ──────────────────────────────────────────────────────────────────

async def cmd_promote(email: str, db_url: str) -> None:
    from app.models.user import User  # noqa: import inside to avoid heavy init

    session, engine = await _get_session(db_url)
    async with session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"[!] No user with email '{email}' found in the database.")
            print("    Log into the app once first so the user is auto-provisioned, then re-run.")
            await engine.dispose()
            sys.exit(1)

        old_role = user.role
        user.role = "super_admin"
        user.plan = "school"  # give full plan access while testing
        await session.commit()
        print(f"[✓] Promoted '{user.name}' ({email})")
        print(f"    role:  {old_role}  →  super_admin")
        print(f"    plan:  {user.plan}")
        print(f"    id:    {user.id}")

    await engine.dispose()


async def cmd_create(email: str, name: str, db_url: str) -> None:
    from app.models.user import User  # noqa

    session, engine = await _get_session(db_url)
    async with session:
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[i] User '{email}' already exists (id={existing.id}).")
            print("    Use 'promote' to upgrade their role instead.")
            existing.role = "super_admin"
            existing.plan = "school"
            await session.commit()
            print(f"[✓] Role set to super_admin.")
            await engine.dispose()
            return

        stub_clerk_id = f"dev_{uuid.uuid4().hex[:16]}"
        user = User(
            id=str(uuid.uuid4()),
            clerk_id=stub_clerk_id,
            email=email,
            name=name,
            role="super_admin",
            plan="school",
        )
        session.add(user)
        await session.commit()
        print(f"[✓] Created stub super_admin user:")
        print(f"    id:       {user.id}")
        print(f"    email:    {email}")
        print(f"    name:     {name}")
        print(f"    clerk_id: {stub_clerk_id}  (stub — real Clerk JWT will NOT match this)")
        print()
        print("NOTE: This stub user bypasses Clerk auth. Use it only for direct DB inspection")
        print("or write tests that skip JWT verification. For full end-to-end testing, use")
        print("'promote' on a real Clerk-authenticated user instead.")

    await engine.dispose()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Manage StudyForge super_admin users")
    parser.add_argument("--db-url", default=_DEFAULT_URL, help="SQLAlchemy async DB URL")
    sub = parser.add_subparsers(dest="command", required=True)

    promote_p = sub.add_parser("promote", help="Promote an existing user to super_admin")
    promote_p.add_argument("--email", required=True, help="Email of the user to promote")

    create_p = sub.add_parser("create", help="Create a new stub super_admin (dev only)")
    create_p.add_argument("--email", required=True, help="Email for the new user")
    create_p.add_argument("--name", default="Super Admin", help="Display name")

    args = parser.parse_args()

    if args.command == "promote":
        asyncio.run(cmd_promote(args.email, args.db_url))
    elif args.command == "create":
        asyncio.run(cmd_create(args.email, args.name, args.db_url))


if __name__ == "__main__":
    main()
