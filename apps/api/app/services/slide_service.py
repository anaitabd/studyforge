import asyncio
import io
import json
import logging
import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches, Pt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file import File
from app.models.slide_deck import Slide, SlideDeck
from app.services.ai_service import ai_service
from app.services.storage_service import storage_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

NAVY = RGBColor(0x1E, 0x3A, 0x5F)
ACCENT = RGBColor(0x25, 0x63, 0xEB)
LIGHT_BLUE = RGBColor(0x93, 0xC2, 0xFD)
TEXT_GRAY = RGBColor(0x37, 0x41, 0x51)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SUBTLE_GRAY = RGBColor(0x9C, 0xA3, 0xAF)


_OUTLINE_SCHEMA = """
{
  "slides": [
    {
      "slide_number": int,                 // 1-based
      "slide_type": "title|section|content|definition|example|quiz|summary",
      "title": string,                     // <= 10 words
      "key_idea": string,                  // 1-2 sentences describing what this slide should teach
      "source_file": string,               // file name to draw from
      "source_pages": [int, ...]           // referenced page numbers
    }
  ]
}
""".strip()


_SLIDE_ENRICH_SCHEMA = """
{
  "bullets": [string, string, ...],         // 3-5 concise bullets, visual phrasing
  "detailed_explanation": string,           // 250-450 words of markdown teaching prose: definition, intuition, edge cases, why it matters
  "examples": [{"title": string, "body": string}, ...],   // 1-2 worked examples (body up to 120 words each)
  "speaker_notes": string,                  // 3-5 sentences of presenter notes
  "quiz": {
    "question": string,
    "options": [string, string, string, string],   // exactly 4 options
    "correct_index": int,                          // 0..3
    "rationale": string                            // why correct option is correct
  }
}
""".strip()


def _strip_code_fence(s: str) -> str:
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _truncate(text: str, n: int) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"


def _format_chunks(chunks: list[dict], char_cap: int = 500) -> str:
    blocks = []
    for c in chunks:
        meta = c.get("metadata") or {}
        page = meta.get("page_number")
        src = meta.get("file_name") or "source"
        prefix = f"[{src} p.{page}]" if page else f"[{src}]"
        blocks.append(f"{prefix}\n{_truncate(c['text'], char_cap)}")
    return "\n\n".join(blocks)


def _cluster_chunks(chunks: list[dict], n_clusters: int) -> list[list[dict]]:
    """Split chunks into ~equal-size sequential clusters. Preserves source order
    so each cluster forms a coherent course section. We do NOT semantic-cluster
    here — it would add LLM cost without big quality wins for typical lecture material.
    """
    n_clusters = max(1, min(n_clusters, max(1, len(chunks))))
    size = max(1, len(chunks) // n_clusters)
    out: list[list[dict]] = []
    for i in range(n_clusters):
        start = i * size
        end = (i + 1) * size if i < n_clusters - 1 else len(chunks)
        sub = chunks[start:end]
        if sub:
            out.append(sub)
    return out


def _normalize_quiz(quiz: Any) -> dict | None:
    if not isinstance(quiz, dict):
        return None
    options = quiz.get("options") or []
    if not isinstance(options, list) or len(options) != 4:
        return None
    try:
        correct = int(quiz.get("correct_index"))
    except (TypeError, ValueError):
        return None
    if correct < 0 or correct > 3:
        return None
    return {
        "question": str(quiz.get("question") or "")[:500],
        "options": [str(o)[:200] for o in options],
        "correct_index": correct,
        "rationale": str(quiz.get("rationale") or "")[:600],
    }


def _normalize_examples(examples: Any) -> list[dict]:
    if not isinstance(examples, list):
        return []
    out: list[dict] = []
    for e in examples:
        if len(out) >= 3:
            break
        if not isinstance(e, dict):
            continue
        title = str(e.get("title") or "Example")[:120]
        body = str(e.get("body") or "")[:1500]
        if body:
            out.append({"title": title, "body": body})
    return out


def _normalize_bullets(bullets: Any) -> list[str]:
    if not isinstance(bullets, list):
        return []
    out = [str(b).strip()[:240] for b in bullets if str(b).strip()]
    return out[:6]


def _files_by_name(files: list[File]) -> dict[str, File]:
    return {f.name: f for f in files}


class SlideService:
    async def generate_full_deck(self, db: AsyncSession, deck_id: str) -> None:
        """Full pipeline: load deck, gather chunks across ALL selected files,
        cluster into sections, generate outline + per-slide enrichment, persist
        Slide rows, render PPTX, mark deck ready.

        Designed to be called from the Celery task (which provides its own DB
        session and event loop)."""
        deck = (
            await db.execute(select(SlideDeck).where(SlideDeck.id == deck_id))
        ).scalar_one_or_none()
        if not deck:
            raise ValueError(f"Deck {deck_id} not found")

        # Retry-idempotency: clear any partial slides from a previous failed attempt.
        await db.execute(delete(Slide).where(Slide.deck_id == deck_id))
        deck.slide_count = 0
        deck.pptx_url = None
        await db.commit()

        files = (
            await db.execute(
                select(File).where(
                    File.group_id == deck.group_id,
                    File.id.in_(deck.file_ids or []),
                    File.status == "ready",
                )
            )
        ).scalars().all()
        if not files:
            raise ValueError("No ready files for this deck")

        chunks = vector_store.get_all_chunks_for_files(
            deck.group_id, [f.id for f in files]
        )
        if not chunks:
            raise ValueError("No indexed content found for the selected files")

        # Sort chunks by file order then page so clusters are coherent.
        file_order = {f.id: i for i, f in enumerate(files)}

        def _sort_key(c: dict) -> tuple[int, int, int]:
            meta = c.get("metadata") or {}
            fid = meta.get("file_id") or ""
            page = meta.get("page_number") or 0
            chunk_idx = meta.get("chunk_index") or 0
            return (file_order.get(fid, 999), int(page), int(chunk_idx))

        chunks.sort(key=_sort_key)

        # Cluster into sections — roughly one cluster per file, capped to 6.
        n_clusters = min(max(len(files), 3), 6)
        clusters = _cluster_chunks(chunks, n_clusters)
        logger.info(
            "Slide gen: deck=%s files=%d total_chunks=%d clusters=%d",
            deck_id, len(files), len(chunks), len(clusters),
        )

        # Phase 1 — outline per cluster, parallelized.
        outline_tasks = [
            self._llm_outline_for_cluster(
                corpus=_format_chunks(cluster[:30], char_cap=500),
                target_slides=max(3, min(8, len(cluster) // 4 + 3)),
                style=deck.style,
                course=deck.course_name or deck.title,
                language=deck.language,
                section_index=i,
                section_count=len(clusters),
            )
            for i, cluster in enumerate(clusters)
        ]
        outline_results = await asyncio.gather(*outline_tasks, return_exceptions=False)
        outlines: list[list[dict]] = [o for o in outline_results if o]

        # Flatten + ensure title + summary slides bookend the deck.
        flat: list[dict] = []
        for section_idx, section_outline in enumerate(outlines):
            if section_idx > 0 and section_outline:
                # Insert a section-break slide between sections for navigation.
                flat.append({
                    "slide_type": "section",
                    "title": section_outline[0].get("title") or f"Section {section_idx + 1}",
                    "key_idea": "Transition to next section.",
                    "source_file": section_outline[0].get("source_file"),
                    "source_pages": [],
                })
            flat.extend(section_outline)

        # Title slide at the very front.
        flat.insert(0, {
            "slide_type": "title",
            "title": deck.title or deck.course_name or "Lecture",
            "key_idea": f"Welcome to {deck.course_name or deck.title}.",
            "source_file": files[0].name,
            "source_pages": [],
        })
        # Summary slide at the end — pull last 2 chunks of EACH file so the
        # recap reflects all source material, not just the last file's intro.
        summary_chunks: list[dict] = []
        for f in files:
            file_chunks = [
                c for c in chunks
                if (c.get("metadata") or {}).get("file_id") == f.id
            ]
            summary_chunks.extend(file_chunks[-2:])
        flat.append({
            "slide_type": "summary",
            "title": "Key takeaways",
            "key_idea": "Recap the most important points across all source material.",
            "source_file": None,
            "source_pages": [],
            "_preset_chunks": summary_chunks,
        })

        # Coverage guarantee — make sure every file appears at least once.
        files_seen = {s.get("source_file") for s in flat if s.get("source_file")}
        for f in files:
            if f.name not in files_seen:
                flat.insert(-1, {
                    "slide_type": "content",
                    "title": f"Bridge: {f.name[:80]}",
                    "key_idea": f"Cover key ideas from {f.name} not yet referenced.",
                    "source_file": f.name,
                    "source_pages": [],
                })

        # Phase 2 — enrich each slide in parallel (bounded concurrency).
        files_by_name = _files_by_name(files)
        resolved_file_ids = [f.id for f in files]
        sem = asyncio.Semaphore(4)

        async def _enrich(idx: int, outline_slide: dict) -> dict:
            stype = outline_slide.get("slide_type", "content")
            # Title/section slides don't need full enrichment.
            if stype in ("title", "section"):
                return self._lightweight_slide(idx, outline_slide)
            file_obj = files_by_name.get(outline_slide.get("source_file") or "")
            mod_chunks = await self._chunks_for_outline_slide(
                outline_slide=outline_slide,
                file_obj=file_obj,
                group_id=deck.group_id,
                resolved_file_ids=resolved_file_ids,
                fallback_chunks=chunks,
                top_k=8,
            )
            corpus = _format_chunks(mod_chunks, char_cap=500)
            async with sem:
                try:
                    payload = await ai_service.generate_structured_json(
                        prompt=self._build_enrich_prompt(
                            outline_slide=outline_slide,
                            corpus=corpus,
                            language=deck.language,
                        ),
                        schema_description=_SLIDE_ENRICH_SCHEMA,
                        max_tokens=3072,
                    )
                except Exception as e:
                    logger.warning(
                        "Slide enrichment failed for slide %d (%s): %s",
                        idx, outline_slide.get("title"), e,
                    )
                    payload = {}
            return self._merge_enrich(idx, outline_slide, payload, mod_chunks)

        enriched = await asyncio.gather(
            *[_enrich(i, s) for i, s in enumerate(flat)]
        )

        # Persist Slide rows + update deck.
        for s in enriched:
            db.add(Slide(
                deck_id=deck_id,
                order_index=s["order_index"],
                slide_type=s["slide_type"],
                title=s["title"],
                bullets=s["bullets"],
                detailed_explanation=s["detailed_explanation"],
                examples=s["examples"],
                speaker_notes=s["speaker_notes"],
                source_file=s["source_file"],
                source_pages=s["source_pages"],
                quiz=s["quiz"],
            ))
        deck.slide_count = len(enriched)
        deck.status = "ready"
        await db.commit()

        # Render PPTX (synchronous CPU work) and upload.
        pptx_bytes = self._build_pptx(enriched, {
            "course_name": deck.course_name,
            "professor_name": deck.professor_name,
        })
        key = f"slides/{deck.group_id}/{deck.id}.pptx"
        await storage_service.upload_file(
            pptx_bytes,
            key,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
        deck.pptx_url = storage_service.get_presigned_url(key, expires_in=86400)
        await db.commit()

    # ── outline ──────────────────────────────────────────────────────────────
    async def _llm_outline_for_cluster(
        self,
        corpus: str,
        target_slides: int,
        style: str,
        course: str,
        language: str,
        section_index: int,
        section_count: int,
    ) -> list[dict]:
        lang = "the same language as the source" if language in ("auto", "") else language
        section_role = (
            "introduction and foundations"
            if section_index == 0
            else "advanced topics and synthesis"
            if section_index == section_count - 1
            else f"core concepts (section {section_index + 1} of {section_count})"
        )
        prompt = (
            f"Design a slide outline of EXACTLY {target_slides} slides for the {section_role} "
            f"of course '{course}'. Style: {style}. "
            "Each slide must teach a distinct, concrete idea — no filler.\n\n"
            "Pick the slide_type DELIBERATELY based on what the slide does:\n"
            "  - 'definition'  : when the slide introduces a new term\n"
            "  - 'example'     : when the slide centers on a worked problem or case\n"
            "  - 'content'     : general teaching slide (intuition, explanation, comparison via markdown table)\n"
            "  - 'quiz'        : sparingly (max 1 per cluster) for an explicit knowledge check\n"
            f"Cite the source_file and real source_pages drawn from the material. Write titles in {lang}.\n\n"
            f"---SOURCE MATERIAL---\n{corpus}"
        )
        try:
            data = await ai_service.generate_structured_json(
                prompt=prompt,
                schema_description=_OUTLINE_SCHEMA,
                max_tokens=2048,
            )
        except Exception as e:
            logger.warning("Outline LLM failed for section %d: %s", section_index, e)
            return []
        slides = data.get("slides") if isinstance(data, dict) else None
        if not isinstance(slides, list):
            return []
        cleaned = []
        for s in slides[:target_slides]:
            if not isinstance(s, dict) or not s.get("title"):
                continue
            cleaned.append({
                "slide_type": str(s.get("slide_type") or "content"),
                "title": str(s.get("title"))[:240],
                "key_idea": str(s.get("key_idea") or "")[:600],
                "source_file": str(s.get("source_file") or "") or None,
                "source_pages": [int(p) for p in (s.get("source_pages") or []) if isinstance(p, int) and p > 0][:8],
            })
        return cleaned

    # ── enrichment ───────────────────────────────────────────────────────────
    def _build_enrich_prompt(
        self, outline_slide: dict, corpus: str, language: str
    ) -> str:
        lang = "the same language as the source" if language in ("auto", "") else language
        return (
            "Write the rich teaching content for ONE slide. Use ONLY the source material below; do not invent facts.\n\n"
            "FORMATTING RULES for `detailed_explanation` (markdown):\n"
            "- Open with a single bold one-line takeaway.\n"
            "- Use `## Subheading` to break the explanation into 2-3 labeled parts. "
            "Pick subheadings that fit THIS slide's topic (e.g. `## Definition`, `## Intuition`, "
            "`## Why it matters`, `## How it works`, `## Common pitfalls`, `## When to use it`) "
            "— do NOT force the same labels on every slide.\n"
            "- Use **bold** for key terms the first time they appear.\n"
            "- When comparing 2+ things or showing a structured set of attributes, use a markdown table.\n"
            "- For code, commands, or formulas, use fenced code blocks with the language tag "
            "(```python, ```bash, ```sql, ```js, etc.).\n"
            "- For step-by-step procedures, use a numbered list.\n"
            "- For non-sequential lists of points, use a bulleted list.\n"
            "- Keep paragraphs short (2-4 sentences). Add blank lines between sections.\n\n"
            "OTHER FIELDS:\n"
            "- `bullets`: 3-5 short visual phrases (NOT full sentences). These appear as the slide's headline points.\n"
            "- `examples`: 1-2 concrete worked examples (specific numbers, real scenarios, or runnable code).\n"
            "  Each example body may use markdown including code blocks.\n"
            "- `speaker_notes`: 3-5 sentences a presenter would say out loud — colloquial, not a re-summary.\n"
            "- `quiz`: a single multiple-choice question answerable from the content above. "
            "Exactly 4 plausible options; only one correct. Rationale explains why the right answer is right.\n\n"
            f"Language: {lang}.\n\n"
            f"Slide title: {outline_slide.get('title')}\n"
            f"Slide type: {outline_slide.get('slide_type')}\n"
            f"Key idea to teach: {outline_slide.get('key_idea')}\n\n"
            f"---SOURCE MATERIAL---\n{corpus}"
        )

    async def _chunks_for_outline_slide(
        self,
        outline_slide: dict,
        file_obj: File | None,
        group_id: str,
        resolved_file_ids: list[str],
        fallback_chunks: list[dict],
        top_k: int,
    ) -> list[dict]:
        """Get the most relevant chunks for a single outline slide.

        Order of preference:
        1. Caller-supplied chunks via ``_preset_chunks`` (used by summary slides).
        2. Vector search using ``title + key_idea`` as the query, scoped to the
           cited file when known. This is what makes per-slide grounding strong.
        3. Filter by cited pages within the scoped file (no LLM call).
        4. First top_k chunks of the scoped file (last-resort fallback).
        """
        preset = outline_slide.get("_preset_chunks")
        if preset:
            return preset[:top_k]

        scope_files = [file_obj.id] if file_obj else resolved_file_ids
        query_text = (
            f"{outline_slide.get('title', '')} {outline_slide.get('key_idea', '')}"
        ).strip() or "course content"

        try:
            embeddings = await ai_service.embed_texts(
                [query_text], input_type="query"
            )
            hits = vector_store.query(
                group_id=group_id,
                query_embedding=embeddings[0],
                top_k=top_k,
                min_score=0.0,  # already pre-filtered by file_id
                file_ids=scope_files,
            )
            if hits:
                return hits
        except Exception as e:
            logger.warning(
                "Vector search for slide '%s' failed (%s); falling back",
                outline_slide.get("title"), e,
            )

        return self._fallback_chunks_by_pages(
            outline_slide=outline_slide,
            file_obj=file_obj,
            all_chunks=fallback_chunks,
            top_k=top_k,
        )

    def _fallback_chunks_by_pages(
        self,
        outline_slide: dict,
        file_obj: File | None,
        all_chunks: list[dict],
        top_k: int,
    ) -> list[dict]:
        scoped = all_chunks
        if file_obj is not None:
            scoped = [
                c for c in all_chunks
                if (c.get("metadata") or {}).get("file_id") == file_obj.id
            ] or all_chunks
        pages = set(outline_slide.get("source_pages") or [])
        if pages:
            page_hits = [
                c for c in scoped
                if (c.get("metadata") or {}).get("page_number") in pages
            ]
            if page_hits:
                return page_hits[:top_k]
        return scoped[:top_k]

    def _merge_enrich(
        self, idx: int, outline_slide: dict, payload: Any, used_chunks: list[dict]
    ) -> dict:
        payload = payload if isinstance(payload, dict) else {}
        source_pages = outline_slide.get("source_pages") or []
        if not source_pages and used_chunks:
            for c in used_chunks:
                p = (c.get("metadata") or {}).get("page_number")
                if isinstance(p, int) and p > 0 and p not in source_pages:
                    source_pages.append(p)
            source_pages = sorted(set(source_pages))[:8]
        return {
            "order_index": idx,
            "slide_type": outline_slide.get("slide_type") or "content",
            "title": outline_slide.get("title") or f"Slide {idx + 1}",
            "bullets": _normalize_bullets(payload.get("bullets")),
            "detailed_explanation": str(payload.get("detailed_explanation") or "").strip(),
            "examples": _normalize_examples(payload.get("examples")),
            "speaker_notes": str(payload.get("speaker_notes") or "").strip()[:2000],
            "source_file": outline_slide.get("source_file"),
            "source_pages": source_pages,
            "quiz": _normalize_quiz(payload.get("quiz")),
        }

    def _lightweight_slide(self, idx: int, outline_slide: dict) -> dict:
        return {
            "order_index": idx,
            "slide_type": outline_slide.get("slide_type") or "title",
            "title": outline_slide.get("title") or f"Slide {idx + 1}",
            "bullets": [],
            "detailed_explanation": str(outline_slide.get("key_idea") or ""),
            "examples": [],
            "speaker_notes": "",
            "source_file": outline_slide.get("source_file"),
            "source_pages": outline_slide.get("source_pages") or [],
            "quiz": None,
        }

    # ── PPTX rendering ───────────────────────────────────────────────────────
    def _build_pptx(self, slides_data: list[dict], config: dict[str, Any]) -> bytes:
        prs = Presentation()
        prs.slide_width = Inches(13.33)
        prs.slide_height = Inches(7.5)
        blank = prs.slide_layouts[6]

        course = config.get("course_name", "Course")
        professor = config.get("professor_name", "")

        for s in slides_data:
            slide = prs.slides.add_slide(blank)
            stype = s.get("slide_type", "content")
            if stype == "title":
                self._render_title(slide, s, course, professor)
            elif stype == "section":
                self._render_section(slide, s)
            else:
                self._render_content(slide, s)

            # Embed the deep explanation in speaker notes so PPTX export carries
            # the rich content for offline study.
            note_parts: list[str] = []
            if s.get("speaker_notes"):
                note_parts.append(s["speaker_notes"])
            if s.get("detailed_explanation"):
                note_parts.append("--- Detailed explanation ---")
                note_parts.append(s["detailed_explanation"])
            if s.get("examples"):
                note_parts.append("--- Examples ---")
                for ex in s["examples"]:
                    note_parts.append(f"{ex.get('title', 'Example')}: {ex.get('body', '')}")
            if s.get("quiz"):
                q = s["quiz"]
                note_parts.append("--- Quiz ---")
                note_parts.append(f"Q: {q.get('question')}")
                for i, opt in enumerate(q.get("options") or []):
                    marker = "*" if i == q.get("correct_index") else "-"
                    note_parts.append(f"  {marker} {opt}")
                if q.get("rationale"):
                    note_parts.append(f"Why: {q['rationale']}")
            slide.notes_slide.notes_text_frame.text = "\n".join(note_parts) or ""

        buf = io.BytesIO()
        prs.save(buf)
        return buf.getvalue()

    def _bg(self, slide, color: RGBColor) -> None:
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.33), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        bg.shadow.inherit = False

    def _render_title(self, slide, s: dict, course: str, professor: str) -> None:
        self._bg(slide, NAVY)
        tb = slide.shapes.add_textbox(Inches(1), Inches(2.5), Inches(11.33), Inches(1.5))
        p = tb.text_frame.paragraphs[0]
        p.text = s.get("title", "Lecture")
        p.font.size = Pt(40)
        p.font.bold = True
        p.font.color.rgb = WHITE

        sub = slide.shapes.add_textbox(Inches(1), Inches(4.2), Inches(11.33), Inches(0.6))
        ps = sub.text_frame.paragraphs[0]
        ps.text = course + (f" · {professor}" if professor else "")
        ps.font.size = Pt(20)
        ps.font.color.rgb = LIGHT_BLUE

        date_box = slide.shapes.add_textbox(Inches(10.3), Inches(7.0), Inches(3), Inches(0.4))
        pd = date_box.text_frame.paragraphs[0]
        pd.text = datetime.utcnow().strftime("%B %d, %Y")
        pd.font.size = Pt(11)
        pd.font.color.rgb = SUBTLE_GRAY

    def _render_section(self, slide, s: dict) -> None:
        self._bg(slide, ACCENT)
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.15), Inches(7.5))
        bar.fill.solid()
        bar.fill.fore_color.rgb = NAVY
        bar.line.fill.background()
        tb = slide.shapes.add_textbox(Inches(1), Inches(3.0), Inches(11.33), Inches(2))
        p = tb.text_frame.paragraphs[0]
        p.text = s.get("title", "Section")
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = WHITE

    def _render_content(self, slide, s: dict) -> None:
        self._bg(slide, WHITE)
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.08), Inches(7.5))
        bar.fill.solid()
        bar.fill.fore_color.rgb = ACCENT
        bar.line.fill.background()

        title_box = slide.shapes.add_textbox(Inches(0.7), Inches(0.6), Inches(12.0), Inches(0.9))
        tp = title_box.text_frame.paragraphs[0]
        tp.text = s.get("title", "")
        tp.font.size = Pt(24)
        tp.font.bold = True
        tp.font.color.rgb = NAVY

        body = slide.shapes.add_textbox(Inches(0.9), Inches(1.7), Inches(12.0), Inches(5.0))
        tf = body.text_frame
        tf.word_wrap = True
        bullets = s.get("bullets", []) or []
        for i, bullet in enumerate(bullets):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = f"▪  {bullet}"
            p.font.size = Pt(18)
            p.font.color.rgb = TEXT_GRAY
            p.space_after = Pt(8)

        src = s.get("source_file") or ""
        if src:
            footer = slide.shapes.add_textbox(Inches(8.5), Inches(7.05), Inches(4.7), Inches(0.4))
            pf = footer.text_frame.paragraphs[0]
            pf.text = f"Source: {src}"
            pf.font.size = Pt(10)
            pf.font.color.rgb = SUBTLE_GRAY


slide_service = SlideService()
