import asyncio
import logging
import random
import uuid

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import File
from app.models.learning_path import (
    LearningPath,
    LearningPathModule,
    LearningPathProgress,
)
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)


_OUTLINE_SCHEMA = """
{
  "title": string,
  "summary": string,                  // 2-3 sentence overview
  "estimated_minutes": int,
  "modules": [
    {
      "title": string,                // <= 8 words
      "objectives": [string, ...],    // 2-4 specific learning outcomes
      "key_concepts": [string, ...],  // 3-6 short concept tags
      "estimated_minutes": int,       // 5-25
      "source_pages": [int, ...]
    }
  ]
}
""".strip()


_MODULE_CONTENT_SCHEMA = """
{
  "content_markdown": string  // 200-400 words of teaching prose with code blocks or examples where relevant
}
""".strip()


def _truncate(text: str, n: int) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"


def _sample_chunks(chunks: list[dict], max_chunks: int) -> list[dict]:
    if len(chunks) <= max_chunks:
        return chunks
    # Stratified-ish sample: keep early/middle/late representation.
    step = len(chunks) / max_chunks
    return [chunks[int(i * step)] for i in range(max_chunks)]


def _format_chunks(chunks: list[dict], char_cap: int = 400) -> str:
    blocks = []
    for c in chunks:
        meta = c.get("metadata") or {}
        page = meta.get("page_number")
        src = meta.get("file_name") or "source"
        prefix = f"[{src} p.{page}]" if page else f"[{src}]"
        blocks.append(f"{prefix}\n{_truncate(c['text'], char_cap)}")
    return "\n\n".join(blocks)


def _build_outline_prompt(
    corpus: str, module_count: int, language: str, title_hint: str | None
) -> str:
    lang = "the same language as the source" if language in ("auto", "") else language
    hint = f"\nCourse focus hint (do not copy verbatim): {title_hint}" if title_hint else ""
    return (
        f"Design a structured learning-path OUTLINE with EXACTLY {module_count} modules. "
        f"Logical order: foundations → core concepts → applied/advanced topics. "
        "Optimize for learner momentum: every module should feel like a concrete milestone. "
        f"For each module include only: title, objectives, key_concepts, estimated_minutes, source_pages. "
        f"Do NOT write the lesson content yet. "
        "Ensure objectives are measurable and action-oriented (e.g., explain, solve, compare, build). "
        "Balance module load so adjacent modules have similar effort and avoid large jumps in complexity. "
        f"Cite real page numbers from the material. Write in {lang}.{hint}\n\n"
        f"---SOURCE MATERIAL---\n{corpus}"
    )


def _build_module_content_prompt(
    module: dict, corpus: str, language: str
) -> str:
    lang = "the same language as the source" if language in ("auto", "") else language
    objectives = "\n".join(f"- {o}" for o in module.get("objectives") or [])
    concepts = ", ".join(module.get("key_concepts") or [])
    return (
        f"Write the teaching content for ONE learning-path module.\n"
        f"Module title: {module.get('title')}\n"
        f"Objectives:\n{objectives}\n"
        f"Key concepts: {concepts}\n\n"
        f"Produce content_markdown of 200-400 words: clear teaching prose, "
        f"short code blocks or worked examples when relevant, no headings above h3. "
        "Use this structure in natural flow: short concept explanation → worked example → quick self-check question. "
        "End with one line titled 'Next step:' that bridges to the likely following module topic. "
        f"Use only information from the source material below. Write in {lang}.\n\n"
        f"---SOURCE MATERIAL---\n{corpus}"
    )


async def generate_path(
    db: AsyncSession,
    group_id: str,
    user_id: str,
    title: str,
    file_ids: list[str] | None,
    module_count: int,
    language: str,
) -> dict:
    module_count = max(3, min(12, module_count))

    # Resolve files
    q = select(File).where(File.group_id == group_id, File.status == "ready")
    if file_ids:
        q = q.where(File.id.in_(file_ids))
    files = (await db.execute(q)).scalars().all()
    if not files:
        raise ValueError("No ready files found in this group.")
    resolved_ids = [f.id for f in files]

    chunks = vector_store.get_all_chunks_for_files(group_id, resolved_ids)
    if not chunks:
        raise ValueError("No indexed content. Wait for processing to finish.")

    outline_sample = _sample_chunks(chunks, max_chunks=15)
    random.shuffle(outline_sample)
    outline_corpus = _format_chunks(outline_sample, char_cap=400)

    logger.info(
        f"Generating learning path outline for group {group_id} "
        f"with {len(outline_sample)} chunks (truncated), target {module_count} modules"
    )
    outline = await ai_service.generate_structured_json(
        prompt=_build_outline_prompt(outline_corpus, module_count, language, title),
        schema_description=_OUTLINE_SCHEMA,
        max_tokens=3072,
    )
    if not isinstance(outline, dict) or not isinstance(outline.get("modules"), list):
        raise ValueError("AI returned unexpected format for path outline.")

    outline_modules = outline["modules"][:module_count]
    logger.info(
        f"Outline ready: {len(outline_modules)} modules. "
        f"Fetching per-module content (max 3 in parallel)."
    )

    sem = asyncio.Semaphore(3)

    async def _fetch_content(m: dict) -> dict | Exception:
        # Pull chunks targeted at this module's concepts via vector search.
        query_text = (m.get("title") or "") + " " + " ".join(m.get("key_concepts") or [])
        try:
            embeddings = await ai_service.embed_texts([query_text.strip() or "course content"], input_type="query")
            mod_chunks = vector_store.query(
                group_id=group_id,
                query_embedding=embeddings[0],
                top_k=6,
                min_score=0.0,
                file_ids=resolved_ids,
            )
        except Exception as e:
            logger.warning(f"Per-module retrieval failed: {e}")
            mod_chunks = outline_sample[:6]

        mod_corpus = _format_chunks(mod_chunks[:6], char_cap=500)
        async with sem:
            try:
                return await ai_service.generate_structured_json(
                    prompt=_build_module_content_prompt(m, mod_corpus, language),
                    schema_description=_MODULE_CONTENT_SCHEMA,
                    max_tokens=1536,
                )
            except Exception as e:
                logger.warning(f"Module content generation failed for '{m.get('title')}': {e}")
                return e

    content_results = await asyncio.gather(*[_fetch_content(m) for m in outline_modules])

    placeholder = "_(content generation failed for this module — regenerate the path or open the module to retry)_"
    raw = {
        "title": outline.get("title") or title,
        "summary": outline.get("summary"),
        "estimated_minutes": outline.get("estimated_minutes"),
        "modules": [],
    }
    for m, content in zip(outline_modules, content_results):
        md = placeholder
        if isinstance(content, dict):
            md = str(content.get("content_markdown") or "").strip() or placeholder
        raw["modules"].append({**m, "content_markdown": md})

    path_id = str(uuid.uuid4())
    path = LearningPath(
        id=path_id,
        group_id=group_id,
        user_id=user_id,
        title=raw.get("title") or title,
        summary=raw.get("summary"),
        estimated_minutes=int(raw.get("estimated_minutes") or 0),
        file_ids=resolved_ids,
        language=language or "en",
    )
    db.add(path)
    await db.flush()

    modules_out = []
    for i, m in enumerate(raw["modules"][:module_count]):
        if not isinstance(m, dict):
            continue
        mod_id = str(uuid.uuid4())
        module = LearningPathModule(
            id=mod_id,
            path_id=path_id,
            order_index=i,
            title=str(m.get("title") or f"Module {i + 1}")[:255],
            objectives=list(m.get("objectives") or []),
            key_concepts=list(m.get("key_concepts") or []),
            content_markdown=str(m.get("content_markdown") or ""),
            estimated_minutes=int(m.get("estimated_minutes") or 10),
            source_pages=[p for p in (m.get("source_pages") or []) if isinstance(p, int)],
        )
        db.add(module)
        modules_out.append({
            "id": mod_id,
            "order_index": i,
            "title": module.title,
            "objectives": module.objectives,
            "key_concepts": module.key_concepts,
            "estimated_minutes": module.estimated_minutes,
            "source_pages": module.source_pages,
        })

    await db.commit()

    return {
        "id": path_id,
        "group_id": group_id,
        "title": path.title,
        "summary": path.summary,
        "estimated_minutes": path.estimated_minutes,
        "language": path.language,
        "file_ids": resolved_ids,
        "module_count": len(modules_out),
        "modules": modules_out,
    }


async def list_paths(db: AsyncSession, group_id: str, user_id: str) -> list[dict]:
    rows = (
        await db.execute(
            select(LearningPath)
            .where(LearningPath.group_id == group_id)
            .order_by(LearningPath.created_at.desc())
        )
    ).scalars().all()
    if not rows:
        return []

    path_ids = [p.id for p in rows]
    module_counts = dict(
        (
            await db.execute(
                select(LearningPathModule.path_id, func.count(LearningPathModule.id))
                .where(LearningPathModule.path_id.in_(path_ids))
                .group_by(LearningPathModule.path_id)
            )
        ).all()
    )
    completed_counts = dict(
        (
            await db.execute(
                select(LearningPathProgress.path_id, func.count(LearningPathProgress.id))
                .where(
                    LearningPathProgress.path_id.in_(path_ids),
                    LearningPathProgress.user_id == user_id,
                )
                .group_by(LearningPathProgress.path_id)
            )
        ).all()
    )

    out = []
    for p in rows:
        total = int(module_counts.get(p.id, 0))
        done = int(completed_counts.get(p.id, 0))
        out.append({
            "id": p.id,
            "title": p.title,
            "summary": p.summary,
            "estimated_minutes": p.estimated_minutes,
            "module_count": total,
            "completed_modules": done,
            "progress_pct": round(100.0 * done / total) if total else 0,
            "created_at": p.created_at.isoformat(),
        })
    return out


async def get_path(db: AsyncSession, group_id: str, path_id: str, user_id: str) -> dict:
    path = (
        await db.execute(
            select(LearningPath).where(
                LearningPath.id == path_id, LearningPath.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not path:
        raise ValueError("Learning path not found")

    modules = (
        await db.execute(
            select(LearningPathModule)
            .where(LearningPathModule.path_id == path_id)
            .order_by(LearningPathModule.order_index)
        )
    ).scalars().all()

    completed_module_ids = set(
        (
            await db.execute(
                select(LearningPathProgress.module_id).where(
                    LearningPathProgress.path_id == path_id,
                    LearningPathProgress.user_id == user_id,
                )
            )
        ).scalars().all()
    )

    modules_out = [
        {
            "id": m.id,
            "order_index": m.order_index,
            "title": m.title,
            "objectives": m.objectives,
            "key_concepts": m.key_concepts,
            "estimated_minutes": m.estimated_minutes,
            "source_pages": m.source_pages,
            "completed": m.id in completed_module_ids,
        }
        for m in modules
    ]
    total = len(modules_out)
    done = sum(1 for m in modules_out if m["completed"])

    return {
        "id": path.id,
        "group_id": path.group_id,
        "title": path.title,
        "summary": path.summary,
        "estimated_minutes": path.estimated_minutes,
        "language": path.language,
        "file_ids": path.file_ids,
        "modules": modules_out,
        "module_count": total,
        "completed_modules": done,
        "progress_pct": round(100.0 * done / total) if total else 0,
        "created_at": path.created_at.isoformat(),
    }


async def get_module(db: AsyncSession, path_id: str, module_id: str, user_id: str) -> dict:
    module = (
        await db.execute(
            select(LearningPathModule).where(
                LearningPathModule.id == module_id,
                LearningPathModule.path_id == path_id,
            )
        )
    ).scalar_one_or_none()
    if not module:
        raise ValueError("Module not found")

    completed = (
        await db.execute(
            select(LearningPathProgress.id).where(
                LearningPathProgress.module_id == module_id,
                LearningPathProgress.user_id == user_id,
            )
        )
    ).scalar_one_or_none() is not None

    return {
        "id": module.id,
        "path_id": module.path_id,
        "order_index": module.order_index,
        "title": module.title,
        "objectives": module.objectives,
        "key_concepts": module.key_concepts,
        "content_markdown": module.content_markdown,
        "estimated_minutes": module.estimated_minutes,
        "source_pages": module.source_pages,
        "completed": completed,
    }


async def mark_complete(
    db: AsyncSession, path_id: str, module_id: str, user_id: str, completed: bool
) -> dict:
    if completed:
        existing = (
            await db.execute(
                select(LearningPathProgress).where(
                    LearningPathProgress.module_id == module_id,
                    LearningPathProgress.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if not existing:
            db.add(
                LearningPathProgress(
                    path_id=path_id, module_id=module_id, user_id=user_id
                )
            )
            await db.commit()
    else:
        await db.execute(
            delete(LearningPathProgress).where(
                LearningPathProgress.module_id == module_id,
                LearningPathProgress.user_id == user_id,
            )
        )
        await db.commit()

    total = (
        await db.execute(
            select(func.count(LearningPathModule.id)).where(
                LearningPathModule.path_id == path_id
            )
        )
    ).scalar_one()
    done = (
        await db.execute(
            select(func.count(LearningPathProgress.id)).where(
                LearningPathProgress.path_id == path_id,
                LearningPathProgress.user_id == user_id,
            )
        )
    ).scalar_one()
    return {
        "module_id": module_id,
        "completed": completed,
        "completed_modules": int(done),
        "module_count": int(total),
        "progress_pct": round(100.0 * done / total) if total else 0,
    }


async def delete_path(db: AsyncSession, group_id: str, path_id: str, user_id: str) -> None:
    path = (
        await db.execute(
            select(LearningPath).where(
                LearningPath.id == path_id, LearningPath.group_id == group_id
            )
        )
    ).scalar_one_or_none()
    if not path:
        raise ValueError("Learning path not found")
    if path.user_id != user_id:
        raise PermissionError("Only the creator can delete this path")
    await db.execute(delete(LearningPath).where(LearningPath.id == path_id))
    await db.commit()
