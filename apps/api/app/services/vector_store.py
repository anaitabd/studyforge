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

    def _collection_name(self, group_id: str) -> str:
        # ChromaDB collection names must be 3-63 chars, alphanumeric + hyphens
        safe = group_id.replace("_", "-").replace(" ", "-")[:50]
        return f"group-{safe}"

    def get_or_create_collection(self, group_id: str) -> chromadb.Collection:
        name = self._collection_name(group_id)
        return self._get_client().get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_chunks(
        self, group_id: str, chunks: list[dict]
    ) -> None:
        """
        Upsert chunks into the group's ChromaDB collection.
        Each chunk dict: {id, text, embedding, metadata}
        Batches in groups of 500.
        """
        collection = self.get_or_create_collection(group_id)
        batch_size = 500

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            collection.upsert(
                ids=[c["id"] for c in batch],
                documents=[c["text"] for c in batch],
                embeddings=[c["embedding"] for c in batch],
                metadatas=[c["metadata"] for c in batch],
            )
        logger.info(f"Upserted {len(chunks)} chunks for group {group_id}")

    def query(
        self,
        group_id: str,
        query_embedding: list[float],
        top_k: int = 8,
        min_score: float = 0.72,
        file_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Retrieve top-k most similar chunks.
        Filters by file_ids if provided.
        Returns chunks with similarity >= min_score.
        """
        collection = self.get_or_create_collection(group_id)

        where = None
        if file_ids:
            if len(file_ids) == 1:
                where = {"file_id": {"$eq": file_ids[0]}}
            else:
                where = {"file_id": {"$in": file_ids}}

        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count() or 1),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error(f"ChromaDB query error for group {group_id}: {e}")
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
                chunks.append(
                    {
                        "text": doc,
                        "metadata": meta,
                        "similarity_score": similarity,
                    }
                )

        return chunks

    def get_all_chunks_for_files(
        self, group_id: str, file_ids: list[str]
    ) -> list[dict]:
        """Retrieve all chunks belonging to specific files (for exam/flashcard generation)."""
        collection = self.get_or_create_collection(group_id)

        where = (
            {"file_id": {"$in": file_ids}}
            if len(file_ids) > 1
            else {"file_id": {"$eq": file_ids[0]}}
        )

        try:
            results = collection.get(
                where=where,
                include=["documents", "metadatas"],
            )
        except Exception:
            return []

        chunks = []
        for doc, meta in zip(results["documents"], results["metadatas"]):
            chunks.append({"text": doc, "metadata": meta})
        return chunks

    def delete_file_chunks(self, group_id: str, file_id: str) -> None:
        """Delete all chunks for a specific file."""
        collection = self.get_or_create_collection(group_id)
        try:
            collection.delete(where={"file_id": {"$eq": file_id}})
            logger.info(f"Deleted chunks for file {file_id} from group {group_id}")
        except Exception as e:
            logger.error(f"Error deleting chunks: {e}")

    def delete_group(self, group_id: str) -> None:
        """Delete the entire collection for a group."""
        name = self._collection_name(group_id)
        try:
            self._get_client().delete_collection(name)
            logger.info(f"Deleted collection for group {group_id}")
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")

    def get_collection_stats(self, group_id: str) -> dict:
        """Return stats about the collection."""
        try:
            collection = self.get_or_create_collection(group_id)
            return {"chunk_count": collection.count(), "group_id": group_id}
        except Exception:
            return {"chunk_count": 0, "group_id": group_id}


# Singleton
vector_store = VectorStore()
