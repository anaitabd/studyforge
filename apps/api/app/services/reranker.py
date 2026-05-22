import asyncio
import logging

logger = logging.getLogger(__name__)


class Reranker:
    """Reranks chunks by similarity score."""

    async def async_rerank(
        self, query: str, chunks: list[dict], top_k: int = 5
    ) -> list[dict]:
        if not chunks:
            return []
        sorted_chunks = sorted(chunks, key=lambda c: c.get("similarity_score", 0), reverse=True)
        return sorted_chunks[:top_k]

    def rerank(self, query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                sorted_chunks = sorted(
                    chunks, key=lambda c: c.get("similarity_score", 0), reverse=True
                )
                return sorted_chunks[:top_k]
            return loop.run_until_complete(self.async_rerank(query, chunks, top_k))
        except Exception as exc:
            logger.warning(f"Reranker failed: {exc}")
            sorted_chunks = sorted(chunks, key=lambda c: c.get("similarity_score", 0), reverse=True)
            return sorted_chunks[:top_k]


reranker = Reranker()
