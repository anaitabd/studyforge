import asyncio
import logging

logger = logging.getLogger(__name__)


class Reranker:
    """
    Reranks chunks using NVIDIA NIM (nv-rerankqa-mistral-4b-v3) when
    NVIDIA_API_KEY is configured, otherwise falls back to similarity-score ordering.
    The rerank() method is sync for compatibility with existing callers;
    async_rerank() is the preferred path for FastAPI routes.
    """

    async def async_rerank(
        self, query: str, chunks: list[dict], top_k: int = 5
    ) -> list[dict]:
        if not chunks:
            return []

        from app.core.config import settings

        if settings.NVIDIA_API_KEY:
            try:
                from app.services.nim_service import nim
                passages = [c["text"] for c in chunks]
                rankings = await nim.rerank(query, passages, top_n=top_k)
                reranked = [chunks[r["index"]] for r in rankings]
                for chunk, ranking in zip(reranked, rankings):
                    chunk["reranker_score"] = ranking["logit"]
                return reranked
            except Exception as exc:
                logger.warning(f"NIM rerank failed: {exc} — falling back to similarity scores")

        # Fallback: sort by existing similarity score
        sorted_chunks = sorted(chunks, key=lambda c: c.get("similarity_score", 0), reverse=True)
        return sorted_chunks[:top_k]

    def rerank(self, query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
        """Sync wrapper — runs the async method in a new event loop if needed."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Inside an async context (FastAPI): caller should use async_rerank directly
                # Here we schedule as a concurrent task — callers that need the result
                # should call async_rerank() instead.
                logger.warning("Reranker.rerank() called from async context; use async_rerank()")
                sorted_chunks = sorted(
                    chunks, key=lambda c: c.get("similarity_score", 0), reverse=True
                )
                return sorted_chunks[:top_k]
            return loop.run_until_complete(self.async_rerank(query, chunks, top_k))
        except Exception as exc:
            logger.warning(f"Reranker sync wrapper failed: {exc}")
            sorted_chunks = sorted(chunks, key=lambda c: c.get("similarity_score", 0), reverse=True)
            return sorted_chunks[:top_k]


reranker = Reranker()
