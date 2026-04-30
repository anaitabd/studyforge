import logging
from typing import Optional

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import CrossEncoder
            _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
            logger.info("Cross-encoder reranker loaded.")
        except Exception as e:
            logger.warning(f"Could not load reranker: {e}. Falling back to similarity scores.")
    return _model


class Reranker:
    def rerank(
        self, query: str, chunks: list[dict], top_k: int = 5
    ) -> list[dict]:
        """
        Rerank chunks using a cross-encoder model for precision.
        Falls back to similarity-score ordering if model unavailable.
        Returns top_k chunks sorted by reranker_score descending.
        """
        if not chunks:
            return []

        model = _get_model()

        if model is None:
            # Fallback: sort by existing similarity score
            sorted_chunks = sorted(
                chunks, key=lambda c: c.get("similarity_score", 0), reverse=True
            )
            return sorted_chunks[:top_k]

        try:
            pairs = [(query, c["text"]) for c in chunks]
            scores = model.predict(pairs)
            for chunk, score in zip(chunks, scores):
                chunk["reranker_score"] = float(score)
            reranked = sorted(chunks, key=lambda c: c["reranker_score"], reverse=True)
            return reranked[:top_k]
        except Exception as e:
            logger.warning(f"Reranker failed: {e}, using similarity fallback")
            sorted_chunks = sorted(
                chunks, key=lambda c: c.get("similarity_score", 0), reverse=True
            )
            return sorted_chunks[:top_k]


# Singleton
reranker = Reranker()
