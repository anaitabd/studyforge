import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class NIMService:
    """
    NVIDIA NIM API client for embeddings and reranking.
    Both endpoints use the OpenAI-compatible base at integrate.api.nvidia.com/v1.
    Reranking uses the dedicated /ranking endpoint (not /embeddings).
    """

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=settings.NVIDIA_BASE_URL,
                headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"},
                timeout=60.0,
            )
        return self._client

    async def embed(self, texts: list[str], input_type: str = "passage") -> list[list[float]]:
        """
        Embed texts using nv-embedqa-e5-v5.
        input_type: "passage" for document chunks, "query" for search queries.
        Batches of up to 32 texts per call.
        """
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        client = self._get_client()

        for i in range(0, len(texts), 32):
            batch = texts[i : i + 32]
            try:
                resp = await client.post(
                    "/embeddings",
                    json={
                        "input": batch,
                        "model": settings.NVIDIA_EMBED_MODEL,
                        "input_type": input_type,
                        "encoding_format": "float",
                        "truncate": "END",
                    },
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                ordered = sorted(data, key=lambda x: x["index"])
                all_embeddings.extend(item["embedding"] for item in ordered)
            except httpx.HTTPStatusError as exc:
                logger.error(f"NIM embed error (batch {i}): {exc.response.text}")
                raise
            except Exception as exc:
                logger.error(f"NIM embed unexpected error: {exc}")
                raise

        return all_embeddings

    async def rerank(
        self,
        query: str,
        passages: list[str],
        top_n: int = 5,
    ) -> list[dict]:
        """
        Rerank passages using nv-rerankqa-mistral-4b-v3.
        Returns list of {index: int, logit: float} sorted by relevance descending.
        """
        if not passages:
            return []

        client = self._get_client()
        try:
            resp = await client.post(
                "/ranking",
                json={
                    "model": settings.NVIDIA_RERANK_MODEL,
                    "query": {"role": "user", "content": query},
                    "passages": [{"role": "user", "content": p} for p in passages],
                    "truncate": "END",
                },
            )
            resp.raise_for_status()
            rankings = resp.json()["rankings"]
            sorted_rankings = sorted(rankings, key=lambda x: x["logit"], reverse=True)
            return sorted_rankings[:top_n]
        except httpx.HTTPStatusError as exc:
            logger.error(f"NIM rerank error: {exc.response.text}")
            raise
        except Exception as exc:
            logger.error(f"NIM rerank unexpected error: {exc}")
            raise

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


nim = NIMService()
