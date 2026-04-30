import tempfile
import os
import pytest
from app.services.file_processor import FileProcessor, _token_estimate


def test_token_estimate():
    text = "hello world " * 100
    assert _token_estimate(text) > 0


def test_clean_text_removes_hyphenation():
    fp = FileProcessor()
    result = fp.clean_text("photo-\nsynthesis is important")
    assert "photosynthesis" in result


def test_clean_text_normalizes_whitespace():
    fp = FileProcessor()
    result = fp.clean_text("hello   world\n\n\n\ntest")
    assert "  " not in result
    assert result.count("\n") <= 3


def test_chunk_text_basic():
    fp = FileProcessor()
    pages = [{"page_number": 1, "text": "This is a test sentence. " * 300}]
    chunks = fp.chunk_text(pages, "file-1", "group-1", "test.pdf")
    assert len(chunks) > 1
    for c in chunks:
        assert "id" in c
        assert "text" in c
        assert "metadata" in c
        assert c["metadata"]["file_id"] == "file-1"
        assert c["metadata"]["group_id"] == "group-1"
        assert c["metadata"]["file_name"] == "test.pdf"


def test_chunk_text_metadata_has_page_number():
    fp = FileProcessor()
    pages = [
        {"page_number": 1, "text": "First page content. " * 10},
        {"page_number": 2, "text": "Second page content. " * 10},
    ]
    chunks = fp.chunk_text(pages, "f1", "g1", "doc.pdf")
    page_numbers = {c["metadata"]["page_number"] for c in chunks}
    assert 1 in page_numbers


def test_extract_text_txt():
    fp = FileProcessor()
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("Hello, this is test content.\nSecond line here.")
        tmp_path = f.name
    try:
        pages = fp.extract_text(tmp_path, "text/plain")
        assert len(pages) == 1
        assert "Hello" in pages[0]["text"]
    finally:
        os.unlink(tmp_path)


def test_chunk_ids_are_unique():
    fp = FileProcessor()
    pages = [{"page_number": 1, "text": "word " * 1000}]
    chunks = fp.chunk_text(pages, "file-x", "group-x", "test.txt")
    ids = [c["id"] for c in chunks]
    assert len(ids) == len(set(ids))
