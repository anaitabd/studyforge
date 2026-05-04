import logging
import re
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)

CHUNK_SIZE_TOKENS = 1024  # Increased from 512 for better context retention
CHUNK_OVERLAP_TOKENS = 256  # Increased from 64 for smoother chunk boundaries
AVG_CHARS_PER_TOKEN = 4  # rough approximation


def _token_estimate(text: str) -> int:
    return max(1, len(text) // AVG_CHARS_PER_TOKEN)


class FileProcessor:

    def extract_text(self, file_path: str, mime_type: str) -> list[dict]:
        """
        Extract text from file. Returns list of {page_number: int, text: str}.
        """
        mime_type = mime_type.lower()

        if "pdf" in mime_type:
            return self._extract_pdf(file_path)
        elif "docx" in mime_type or "wordprocessingml" in mime_type or mime_type == "application/msword":
            return self._extract_docx(file_path)
        elif "pptx" in mime_type or "presentationml" in mime_type:
            return self._extract_pptx(file_path)
        elif "text" in mime_type or mime_type in ("text/plain", "text/markdown"):
            return self._extract_text(file_path)
        else:
            # Fallback: try as text
            return self._extract_text(file_path)

    def _extract_pdf(self, file_path: str) -> list[dict]:
        try:
            import pypdfium2 as pdfium
        except ImportError:
            return self._extract_pdf_pdfplumber(file_path)

        pages = []
        try:
            pdf = pdfium.PdfDocument(file_path)
            try:
                for i in range(len(pdf)):
                    page = pdf[i]
                    try:
                        textpage = page.get_textpage()
                        text = textpage.get_text_range() or ""
                        textpage.close()
                    finally:
                        page.close()
                    if text.strip():
                        pages.append({"page_number": i + 1, "text": text})
            finally:
                pdf.close()
        except Exception as e:
            logger.error(f"PDF extraction error (pdfium): {e}; falling back to pdfplumber")
            return self._extract_pdf_pdfplumber(file_path)
        return pages

    def _extract_pdf_pdfplumber(self, file_path: str) -> list[dict]:
        import pdfplumber
        pages = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append({"page_number": i, "text": text})
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
        return pages

    def _extract_docx(self, file_path: str) -> list[dict]:
        from docx import Document
        try:
            doc = Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n".join(paragraphs)
            return [{"page_number": 1, "text": text}] if text else []
        except Exception as e:
            logger.error(f"DOCX extraction error: {e}")
            return []

    def _extract_pptx(self, file_path: str) -> list[dict]:
        from pptx import Presentation
        pages = []
        try:
            prs = Presentation(file_path)
            for i, slide in enumerate(prs.slides, start=1):
                texts = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        texts.append(shape.text.strip())
                if texts:
                    pages.append({"page_number": i, "text": "\n".join(texts)})
        except Exception as e:
            logger.error(f"PPTX extraction error: {e}")
        return pages

    def _extract_text(self, file_path: str) -> list[dict]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
            return [{"page_number": 1, "text": text}] if text.strip() else []
        except Exception as e:
            logger.error(f"Text extraction error: {e}")
            return []

    def clean_text(self, text: str) -> str:
        """Clean extracted text: fix hyphenation, normalize whitespace, remove page numbers."""
        # Fix hyphenated line breaks
        text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)
        # Remove common page number patterns
        text = re.sub(r"\n?\s*-?\s*\d+\s*-?\s*\n", "\n", text)
        text = re.sub(r"\nPage\s+\d+\s*\n", "\n", text, flags=re.IGNORECASE)
        # Normalize unicode whitespace (non-breaking space, zero-width space,
        # thin space, ideographic space, etc.) — listed explicitly to avoid
        # accidentally creating a broad character range in the regex engine.
        text = re.sub(
            r"[ ­​‌‍  　]+",
            " ",
            text,
        )
        # Collapse multiple blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Collapse multiple spaces
        text = re.sub(r" {2,}", " ", text)
        return text.strip()

    def chunk_text(
        self,
        pages: list[dict],
        file_id: str,
        group_id: str,
        file_name: str,
    ) -> list[dict]:
        """
        Recursive character splitter.
        chunk_size = CHUNK_SIZE_TOKENS tokens, overlap = CHUNK_OVERLAP_TOKENS tokens.
        Split priority: paragraph → newline → sentence → word.
        """
        chunks = []
        chunk_index = 0

        for page in pages:
            page_number = page["page_number"]
            text = self.clean_text(page["text"])
            if not text:
                continue

            page_chunks = self._split_text(text)

            for chunk_text in page_chunks:
                if not chunk_text.strip():
                    continue
                char_start = text.find(chunk_text[:20])
                chunks.append(
                    {
                        "id": f"file_{file_id}_chunk_{chunk_index}",
                        "text": chunk_text.strip(),
                        "metadata": {
                            "file_id": file_id,
                            "group_id": group_id,
                            "file_name": file_name,
                            "page_number": page_number,
                            "chunk_index": chunk_index,
                            "char_start": max(0, char_start),
                        },
                    }
                )
                chunk_index += 1

        return chunks

    def _split_text(self, text: str) -> list[str]:
        """Recursively split text into chunks of ~CHUNK_SIZE_TOKENS tokens with overlap."""
        max_chars = CHUNK_SIZE_TOKENS * AVG_CHARS_PER_TOKEN
        overlap_chars = CHUNK_OVERLAP_TOKENS * AVG_CHARS_PER_TOKEN

        if _token_estimate(text) <= CHUNK_SIZE_TOKENS:
            return [text]

        separators = ["\n\n", "\n", ". ", " "]
        chunks = []

        for sep in separators:
            parts = text.split(sep)
            if len(parts) > 1:
                current = ""
                for part in parts:
                    candidate = current + (sep if current else "") + part
                    if _token_estimate(candidate) > CHUNK_SIZE_TOKENS and current:
                        chunks.append(current)
                        # Start next chunk with overlap
                        overlap_text = current[-overlap_chars:] if len(current) > overlap_chars else current
                        current = overlap_text + (sep if overlap_text else "") + part
                    else:
                        current = candidate
                if current.strip():
                    chunks.append(current)
                return [c for c in chunks if c.strip()]

        # Hard split if no separator found
        step = max_chars - overlap_chars
        return [text[i : i + max_chars] for i in range(0, len(text), max(step, 1))]


# Singleton
file_processor = FileProcessor()
