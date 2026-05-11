import logging
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

_DISTANCE_TO_SIMILARITY = lambda d: 1.0 - d  # cosine distance → similarity


class VectorStore:
    def __init__(self):
        self.client = None

    def _get_client(self):
        if self.client is None:
            self.client = chromadb.HttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            logger.info(f"ChromaDB HTTP client → {settings.CHROMA_HOST}:{settings.CHROMA_PORT}")
        return self.client

    @staticmethod
    def _collection_name(org_id: str | None, user_id: str) -> str:
        """
        Org users share a collection scoped to org_id.
        Individual users get a personal collection scoped to user_id.
        Collection names: 3–63 chars, alphanumeric + hyphens only.
        """
        if org_id:
            safe = org_id.replace("_", "-").replace(" ", "-")[:55]
            return f"org-{safe}"
        safe = user_id.replace("_", "-").replace(" ", "-")[:53]
        return f"user-{safe}"

    def _legacy_group_collection_name(self, group_id: str) -> str:
        safe = group_id.replace("_", "-").replace(" ", "-")[:50]
        return f"group-{safe}"

    def get_or_create_collection(
        self, org_id: str | None, user_id: str
    ) -> chromadb.Collection:
        name = self._collection_name(org_id, user_id)
        return self._get_client().get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_chunks(
        self,
        chunks: list[dict],
        org_id: str | None,
        user_id: str,
    ) -> None:
        """
        Upsert chunks into the org or user collection.
        Each chunk dict: {id, text, embedding, metadata}
        metadata must include file_id, group_id, org_id.
        """
        collection = self.get_or_create_collection(org_id, user_id)
        batch_size = 500
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            collection.upsert(
                ids=[c["id"] for c in batch],
                documents=[c["text"] for c in batch],
                embeddings=[c["embedding"] for c in batch],
                metadatas=[c["metadata"] for c in batch],
            )
        logger.info(
            "Upserted %d chunks into collection %s",
            len(chunks),
            self._collection_name(org_id, user_id),
        )

    def query(
        self,
        org_id: str | None,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 8,
        min_score: float = 0.72,
        file_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """Retrieve top-k most similar chunks, optionally filtered by file_ids."""
        collection = self.get_or_create_collection(org_id, user_id)

        where = None
        if file_ids:
            where = (
                {"file_id": {"$eq": file_ids[0]}}
                if len(file_ids) == 1
                else {"file_id": {"$in": file_ids}}
            )

        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count() or 1),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error("ChromaDB query error for collection %s: %s", self._collection_name(org_id, user_id), e)
            return []

        chunks = []
        if not results["ids"] or not results["ids"][0]:
            return chunks

        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            similarity = _DISTANCE_TO_SIMILARITY(dist)
            if similarity >= min_score:
                chunks.append({"text": doc, "metadata": meta, "similarity_score": similarity})

        return chunks

    def get_all_chunks_for_files(
        self,
        file_ids: list[str],
        org_id: str | None,
        user_id: str,
    ) -> list[dict]:
        """Retrieve all chunks for specific files (used by exam/flashcard generation)."""
        collection = self.get_or_create_collection(org_id, user_id)

        where = (
            {"file_id": {"$in": file_ids}}
            if len(file_ids) > 1
            else {"file_id": {"$eq": file_ids[0]}}
        )

        try:
            results = collection.get(where=where, include=["documents", "metadatas"])
        except Exception:
            return []

        return [
            {"text": doc, "metadata": meta}
            for doc, meta in zip(results["documents"], results["metadatas"])
        ]

    def delete_file_chunks(
        self, file_id: str, org_id: str | None, user_id: str
    ) -> None:
        """Delete all chunks for a specific file."""
        collection = self.get_or_create_collection(org_id, user_id)
        try:
            collection.delete(where={"file_id": {"$eq": file_id}})
            logger.info("Deleted chunks for file %s", file_id)
        except Exception as e:
            logger.error("Error deleting chunks for file %s: %s", file_id, e)

    def delete_group(self, group_id: str) -> None:
        """Delete the legacy group-scoped collection (used during migration)."""
        name = self._legacy_group_collection_name(group_id)
        try:
            self._get_client().delete_collection(name)
            logger.info("Deleted legacy collection for group %s", group_id)
        except Exception as e:
            logger.error("Error deleting legacy collection for group %s: %s", group_id, e)

    def get_collection_stats(self, org_id: str | None, user_id: str) -> dict:
        """Return stats about a collection."""
        try:
            collection = self.get_or_create_collection(org_id, user_id)
            return {
                "chunk_count": collection.count(),
                "collection_name": self._collection_name(org_id, user_id),
            }
        except Exception:
            return {"chunk_count": 0, "collection_name": self._collection_name(org_id, user_id)}


# Singleton
vector_store = VectorStore()
