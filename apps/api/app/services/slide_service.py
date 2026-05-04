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


def _strip_code_fence(s: str) -> str:
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


class SlideService:
    async def generate_slide_deck(
        self,
        group_id: str,
        file_ids: list[str],
        config: dict[str, Any],
    ) -> str:
        chunks = vector_store.get_all_chunks_for_files(group_id, file_ids)[:50]
        if not chunks:
            raise ValueError("No content found for the selected files")

        chunks_text = "\n\n".join(
            f"[{c['metadata'].get('source', 'source')}]\n{c['text']}" for c in chunks
        )
        slides_data = await self._llm_outline(config, chunks_text)
        pptx_bytes = self._build_pptx(slides_data, config)

        key = f"slides/{group_id}/{uuid4().hex}.pptx"
        await storage_service.upload_file(
            pptx_bytes,
            key,
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
        return storage_service.get_presigned_url(key, expires_in=3600)

    async def _llm_outline(self, config: dict[str, Any], chunks_text: str) -> list[dict]:
        style = config.get("style", "academic")
        course = config.get("course_name", "Course")
        professor = config.get("professor_name", "")
        language = config.get("language", "en")

        system = (
            "You are an educational slide content designer. "
            f"Generate a complete lecture slide deck as a JSON array. Style: {style}. "
            "Each slide object must have: slide_number, slide_type "
            "(title|section_header|content|definition|summary), title (max 8 words), "
            "bullets (array of strings), speaker_notes (3-5 sentences), source_file. "
            "Start with a title slide. Add section headers between topics. "
            "End with a key takeaways summary slide. "
            "Return ONLY a valid JSON array, no markdown, no explanation."
        )
        user = (
            f"Generate slides for course: {course}\n"
            f"Professor: {professor}\n"
            f"Language: {language}\n\n"
            f"[COURSE MATERIAL]\n{chunks_text}"
        )
        raw = await ai_service.chat_completion(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            stream=False,
            temperature=0.3,
            max_tokens=6000,
        )
        try:
            data = json.loads(_strip_code_fence(raw))
            if not isinstance(data, list):
                raise ValueError("LLM did not return a JSON array")
            return data
        except Exception as e:
            logger.exception("Failed to parse slide outline JSON")
            raise ValueError(f"Slide outline parse error: {e}") from e

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
            elif stype == "section_header":
                self._render_section(slide, s)
            else:
                self._render_content(slide, s)

            notes = s.get("speaker_notes") or ""
            slide.notes_slide.notes_text_frame.text = notes

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
