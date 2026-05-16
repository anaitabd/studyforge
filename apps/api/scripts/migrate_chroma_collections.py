"""
Idempotent migration: move chunks from legacy group-{group_id} collections
into the new org-{org_id} or user-{user_id} collections.

Run once after deploying the vector_store refactor:

    python scripts/migrate_chroma_collections.py

Safe to re-run: skips any file whose chunks already exist in the target collection.
"""
import asyncio
import logging
import sys
import os

# Allow running from repo root or from apps/api/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import chromadb
from chromadb.config import Settings as ChromaSettings
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def _migrate():
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.models.file import File
    from app.models.user import User
    from app.services.vector_store import vector_store

    client = chromadb.HttpClient(
        host=settings.CHROMA_HOST,
        port=settings.CHROMA_PORT,
        settings=ChromaSettings(anonymized_telemetry=False),
    )

    # List all existing legacy group-* collections
    all_collections = client.list_collections()
    legacy_names = {c.name for c in all_collections if c.name.startswith("group-")}
    if not legacy_names:
        logger.info("No legacy group-* collections found. Nothing to migrate.")
        return

    logger.info("Found %d legacy collection(s): %s", len(legacy_names), legacy_names)

    async with AsyncSessionLocal() as db:
        files = (
            await db.execute(
                select(File, User)
                .join(User, User.id == File.user_id)
                .where(File.status == "ready", File.chunk_count > 0)
            )
        ).all()

    logger.info("Found %d ready files to migrate.", len(files))

    migrated = skipped = errors = 0

    for file_row, uploader in files:
        org_id: str | None = uploader.org_id
        user_id: str = uploader.id
        file_id: str = file_row.id
        group_id: str = file_row.group_id

        legacy_name = f"group-{group_id.replace('_', '-').replace(' ', '-')[:50]}"
        if legacy_name not in legacy_names:
            # Already migrated or never had a legacy collection
            skipped += 1
            continue

        # Check if target collection already has chunks for this file
        target_collection = vector_store.get_or_create_collection(org_id, user_id)
        try:
            existing = target_collection.get(
                where={"file_id": {"$eq": file_id}},
                include=[],
            )
            if existing["ids"]:
                logger.debug("File %s already in target collection — skip", file_id)
                skipped += 1
                continue
        except Exception as e:
            logger.warning("Could not check target for file %s: %s", file_id, e)

        # Pull chunks from the legacy collection
        try:
            legacy_col = client.get_collection(
                legacy_name,
                embedding_function=None,
            )
            results = legacy_col.get(
                where={"file_id": {"$eq": file_id}},
                include=["documents", "metadatas", "embeddings"],
            )
        except Exception as e:
            logger.error("Failed to read legacy collection %s for file %s: %s", legacy_name, file_id, e)
            errors += 1
            continue

        ids = results.get("ids") or []
        if not ids:
            logger.debug("Legacy collection %s has no chunks for file %s", legacy_name, file_id)
            skipped += 1
            continue

        documents = results["documents"]
        metadatas = results["metadatas"]
        embeddings = results["embeddings"]

        # Ensure org_id is stamped in metadata for new collection
        for meta in metadatas:
            if org_id:
                meta["org_id"] = org_id
            meta["user_id"] = user_id

        # Upsert into the new collection in batches
        batch_size = 500
        try:
            for i in range(0, len(ids), batch_size):
                target_collection.upsert(
                    ids=ids[i : i + batch_size],
                    documents=documents[i : i + batch_size],
                    embeddings=embeddings[i : i + batch_size],
                    metadatas=metadatas[i : i + batch_size],
                )
            migrated += 1
            logger.info(
                "Migrated %d chunks for file %s → collection %s",
                len(ids),
                file_id,
                target_collection.name,
            )
        except Exception as e:
            logger.error("Failed to upsert file %s into target: %s", file_id, e)
            errors += 1

    logger.info(
        "Migration complete. migrated=%d skipped=%d errors=%d",
        migrated,
        skipped,
        errors,
    )

    # Optionally delete legacy collections once all files are migrated
    if errors == 0:
        logger.info("No errors — deleting %d legacy collection(s)…", len(legacy_names))
        for name in legacy_names:
            try:
                client.delete_collection(name)
                logger.info("Deleted legacy collection: %s", name)
            except Exception as e:
                logger.warning("Could not delete %s: %s", name, e)
    else:
        logger.warning(
            "%d error(s) encountered — legacy collections left intact for retry.",
            errors,
        )


if __name__ == "__main__":
    asyncio.run(_migrate())
