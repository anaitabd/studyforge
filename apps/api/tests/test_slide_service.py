import pytest

from app.services.slide_service import (
    _cluster_chunks,
    _normalize_bullets,
    _normalize_examples,
    _normalize_quiz,
)


def _chunks(n: int) -> list[dict]:
    return [{"text": f"c{i}", "metadata": {}} for i in range(n)]


def test_cluster_chunks_splits_evenly():
    chunks = _chunks(12)
    out = _cluster_chunks(chunks, 4)
    assert len(out) == 4
    assert sum(len(c) for c in out) == 12
    assert {len(c) for c in out} == {3}


def test_cluster_chunks_handles_uneven_split():
    chunks = _chunks(10)
    out = _cluster_chunks(chunks, 3)
    assert len(out) == 3
    # Last cluster absorbs the remainder.
    assert sum(len(c) for c in out) == 10


def test_cluster_chunks_with_fewer_chunks_than_clusters():
    chunks = _chunks(2)
    out = _cluster_chunks(chunks, 5)
    # Should not produce empty clusters.
    assert all(c for c in out)
    assert sum(len(c) for c in out) == 2


def test_normalize_quiz_valid():
    quiz = {
        "question": "Pick a letter",
        "options": ["a", "b", "c", "d"],
        "correct_index": 2,
        "rationale": "because c",
    }
    out = _normalize_quiz(quiz)
    assert out is not None
    assert out["correct_index"] == 2
    assert len(out["options"]) == 4


@pytest.mark.parametrize("bad", [
    None,
    {},
    {"options": ["a", "b"], "correct_index": 0},  # only 2 options
    {"options": ["a", "b", "c", "d"], "correct_index": 9},  # out of range
    {"options": ["a", "b", "c", "d"], "correct_index": "bad"},  # non-int
])
def test_normalize_quiz_rejects_bad_input(bad):
    assert _normalize_quiz(bad) is None


def test_normalize_examples_caps_and_filters():
    raw = [
        {"title": "Ex1", "body": "first"},
        {"title": "Ex2", "body": ""},  # filtered: empty body
        "garbage",                      # filtered: not dict
        {"title": "Ex3", "body": "third"},
        {"title": "Ex4", "body": "fourth"},
        {"title": "Ex5", "body": "fifth"},  # exceeds 3-cap
    ]
    out = _normalize_examples(raw)
    assert len(out) == 3
    assert [e["title"] for e in out] == ["Ex1", "Ex3", "Ex4"]


def test_normalize_bullets_dedupes_blank_and_caps():
    raw = ["one", "  ", "two", "", "three", "four", "five", "six", "seven"]
    out = _normalize_bullets(raw)
    assert len(out) == 6
    assert "  " not in out
    assert "" not in out


def test_normalize_bullets_handles_non_list():
    assert _normalize_bullets(None) == []
    assert _normalize_bullets("not a list") == []
