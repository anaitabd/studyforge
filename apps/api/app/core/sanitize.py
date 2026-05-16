import re


def sanitize_text(text: str, max_length: int = 10000) -> str:
    """Strip control characters and limit length."""
    if not text:
        return ""
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return cleaned[:max_length]
