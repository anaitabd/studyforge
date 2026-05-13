import logging
import random
import uuid
from datetime import date, timedelta

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import File
from app.models.flashcard import Flashcard, FlashcardProgress, FlashcardSet
from app.services.ai_service import ai_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

_CARD_SCHEMA = (
    "Array of objects, each with: "
    '"front" (a concise question, term, or prompt — one sentence max), '
    '"back" (the answer, definition, or explanation — 1-3 sentences), '
    '"source_passage" (a short passage closely paraphrased from the material above '
    '— must reflect content actually present in the provided text, not invented)'
)

# SM-2 quality values per rating
_QUALITY = {"again": 0, "hard": 2, "good": 4, "easy": 5}


# ── SM-2 algorithm ────────────────────────────────────────────────────────────

def _sm2_next(
    ease_factor: float,
    interval_days: int,
    reps: int,
    quality: int,
) -> tuple[float, int, int, date]:
    """
    Returns (new_ease_factor, new_interval_days, new_reps, due_date).
    Standard SM-2 algorithm with quality 0-5.
    """
    if quality < 3:
        # Failed recall — reset but keep ease_factor
        new_reps = 0
        new_interval = 1
        new_ef = ease_factor
    else:
        new_reps = reps + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(interval_days * ease_factor)

        new_ef = ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        new_ef = max(1.3, new_ef)

    due = date.today() + timedelta(days=new_interval)
    return new_ef, new_interval, new_reps, due


# ── generation ────────────────────────────────────────────────────────────────

def _sample_chunks_for_cards(chunks: list[dict], max_cards: int) -> list[dict]:
    """
    Target ~1 card per chunk; cap at max_cards chunks.
    Stratified: beginning / middle / end.
    """
    target = min(len(chunks), max_cards)
    if len(chunks) <= target:
        return chunks

    third = target // 3
    remainder = target - third * 3
    n = len(chunks)
    start = chunks[: n // 3]
    mid = chunks[n // 3 : 2 * n // 3]
    end = chunks[2 * n // 3 :]

    return (
        random.sample(start, min(third + remainder, len(start)))
        + random.sample(mid, min(third, len(mid)))
        + random.sample(end, min(third, len(end)))
    )


def _build_generation_prompt(chunks: list[dict], max_cards: int, language: str) -> str:
    lang_instruction = {
        "fr": "Write all fronts, backs, and source passages in French.",
        "ar": "Write all fronts, backs, and source passages in Arabic.",
        "es": "Write all fronts, backs, and source passages in Spanish.",
        "en": "Write all fronts, backs, and source passages in English.",
        "auto": "Match the language of the source material.",
    }.get(language, "Match the language of the source material.")

    context_parts = []
    for i, chunk in enumerate(chunks):
        meta = chunk.get("metadata", {})
        file_name = meta.get("file_name", "Unknown file")
        page = meta.get("page_number", "?")
        context_parts.append(
            f"[Source {i + 1} — {file_name}, page {page}]\n{chunk['text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    return (
        f"Generate up to {max_cards} flashcards from the following course material.\n\n"
        "Focus on: key terms and definitions, important formulas, dates and events, "
        "core concepts, and cause-effect relationships.\n\n"
        "Rules:\n"
        "- front: must be specific and testable.\n"
        "  BAD:  \"What is entropy?\"\n"
        "  GOOD: \"What happens to the available energy in a closed system as entropy increases?\"\n"
        "  BAD:  \"What is photosynthesis?\"\n"
        "  GOOD: \"Which molecule is produced by photosynthesis that plants use for energy storage?\"\n"
        "- back must directly answer the front in 1-3 sentences.\n"
        "- source_passage must be a short passage closely paraphrased from the material below.\n"
        "- Do NOT repeat the same concept twice.\n"
        "- Do NOT generate cards for trivial facts (page numbers, author names, etc.).\n"
        f"- {lang_instruction}\n\n"
        f"COURSE MATERIAL:\n\n{context}"
    )


def _dedup_cards(raw_cards: list) -> list:
    """Remove cards whose front is >75% similar to a previously seen front."""
    seen_fronts: list[str] = []
    deduped = []
    for card in raw_cards:
        if not isinstance(card, dict):
            continue
        front = card.get("front", "").lower().strip()
        if not front:
            continue
        front_tokens = set(front.split())
        is_duplicate = False
        for seen in seen_fronts:
            seen_tokens = set(seen.split())
            if not seen_tokens:
                continue
            overlap = len(front_tokens & seen_tokens) / max(len(front_tokens), len(seen_tokens), 1)
            if overlap > 0.75:
                is_duplicate = True
                break
        if not is_duplicate:
            seen_fronts.append(front)
            deduped.append(card)
    return deduped


async def generate_set(
    db: AsyncSession,
    group_id: str,
    user_id: str,
    org_id: str | None,
    title: str,
    file_ids: list[str] | None = None,
    max_cards: int = 40,
    language: str = "auto",
) -> dict:
    """
    Generate a flashcard set from group files and persist it to the DB.
    """
    max_cards = max(10, min(100, max_cards))

    # Resolve files
    if file_ids:
        result = await db.execute(
            select(File).where(
                File.id.in_(file_ids),
                File.group_id == group_id,
                File.status == "ready",
            )
        )
        files = result.scalars().all()
        if not files:
            raise ValueError("No ready files found for the specified file IDs.")
        resolved_ids = [f.id for f in files]
    else:
        result = await db.execute(
            select(File).where(File.group_id == group_id, File.status == "ready")
        )
        files = result.scalars().all()
        if not files:
            raise ValueError("No ready files in this group. Upload and process files first.")
        resolved_ids = [f.id for f in files]

    # Fetch & sample chunks
    all_chunks = vector_store.get_all_chunks_for_files(resolved_ids, org_id, user_id)
    if not all_chunks:
        raise ValueError("No indexed content found. Files may still be processing.")

    sampled = _sample_chunks_for_cards(all_chunks, max_cards)
    prompt = _build_generation_prompt(sampled, max_cards, language)

    logger.info(
        f"Generating flashcards for group {group_id} "
        f"using {len(sampled)} chunks, target {max_cards} cards"
    )

    raw_cards = await ai_service.generate_structured_json(
        prompt=prompt,
        schema_description=_CARD_SCHEMA,
        max_tokens=8192,
    )

    if not isinstance(raw_cards, list):
        raise ValueError("AI returned unexpected format for flashcards.")

    raw_cards = _dedup_cards(raw_cards)

    # Persist set
    set_id = str(uuid.uuid4())
    primary_file_id = resolved_ids[0] if len(resolved_ids) == 1 else None
    card_set = FlashcardSet(
        id=set_id,
        group_id=group_id,
        file_id=primary_file_id,
        user_id=user_id,
        title=title,
    )
    db.add(card_set)
    # Force the set INSERT before the cards so the FK is satisfied
    # regardless of SQLAlchemy's unit-of-work ordering.
    await db.flush()

    cards_out = []
    for i, raw in enumerate(raw_cards):
        if not isinstance(raw, dict):
            continue
        if not raw.get("front") or not raw.get("back"):
            continue

        card_id = str(uuid.uuid4())
        card = Flashcard(
            id=card_id,
            set_id=set_id,
            front=raw["front"],
            back=raw["back"],
            source_passage=raw.get("source_passage", ""),
            order_index=i,
        )
        db.add(card)
        cards_out.append({
            "id": card_id,
            "front": card.front,
            "back": card.back,
            "source_passage": card.source_passage,
            "order_index": i,
        })

    await db.commit()

    return {
        "id": set_id,
        "group_id": group_id,
        "title": title,
        "card_count": len(cards_out),
        "cards": cards_out,
        "created_at": card_set.created_at.isoformat() if card_set.created_at else None,
    }


# ── study session helpers ─────────────────────────────────────────────────────

async def get_due_cards(
    db: AsyncSession,
    set_id: str,
    user_id: str,
    limit: int = 20,
) -> list[dict]:
    """
    Return cards that are due for review today (or have never been studied).
    Cards are sorted: new cards first, then overdue, then due today.
    """
    # All cards in set
    cards_result = await db.execute(
        select(Flashcard).where(Flashcard.set_id == set_id).order_by(Flashcard.order_index)
    )
    cards = cards_result.scalars().all()
    if not cards:
        return []

    card_ids = [c.id for c in cards]

    # Existing progress records for this user
    progress_result = await db.execute(
        select(FlashcardProgress).where(
            FlashcardProgress.card_id.in_(card_ids),
            FlashcardProgress.user_id == user_id,
        )
    )
    progress_map = {p.card_id: p for p in progress_result.scalars().all()}

    today = date.today()
    due = []
    for card in cards:
        prog = progress_map.get(card.id)
        if prog is None:
            # New card — never studied
            due.append((0, card, prog))
        elif prog.due_date <= today:
            days_overdue = (today - prog.due_date).days
            due.append((-(days_overdue + 1), card, prog))

    # Sort: new (0) first, then most overdue
    due.sort(key=lambda x: x[0])

    result = []
    for _, card, prog in due[:limit]:
        result.append({
            "id": card.id,
            "front": card.front,
            "back": card.back,
            "source_passage": card.source_passage,
            "order_index": card.order_index,
            "progress": {
                "reps": prog.reps if prog else 0,
                "interval_days": prog.interval_days if prog else 1,
                "ease_factor": prog.ease_factor if prog else 2.5,
                "due_date": prog.due_date.isoformat() if prog else today.isoformat(),
            },
        })
    return result


async def record_review(
    db: AsyncSession,
    card_id: str,
    user_id: str,
    rating: str,
) -> dict:
    """
    Record a flashcard review and update SM-2 state.
    rating: 'again' | 'hard' | 'good' | 'easy'
    """
    quality = _QUALITY.get(rating)
    if quality is None:
        raise ValueError("rating must be one of: again, hard, good, easy")

    result = await db.execute(
        select(FlashcardProgress).where(
            FlashcardProgress.card_id == card_id,
            FlashcardProgress.user_id == user_id,
        )
    )
    prog = result.scalar_one_or_none()

    if prog is None:
        # First review — bootstrap with defaults
        ef, interval, reps, due = _sm2_next(2.5, 1, 0, quality)
        prog = FlashcardProgress(
            id=str(uuid.uuid4()),
            card_id=card_id,
            user_id=user_id,
            ease_factor=ef,
            interval_days=interval,
            due_date=due,
            reps=reps,
        )
        db.add(prog)
    else:
        ef, interval, reps, due = _sm2_next(
            prog.ease_factor, prog.interval_days, prog.reps, quality
        )
        prog.ease_factor = ef
        prog.interval_days = interval
        prog.reps = reps
        prog.due_date = due

    await db.commit()

    return {
        "card_id": card_id,
        "rating": rating,
        "ease_factor": prog.ease_factor,
        "interval_days": prog.interval_days,
        "reps": prog.reps,
        "due_date": prog.due_date.isoformat(),
    }
