import logging
from typing import AsyncGenerator

from app.services.ai_service import ai_service
from app.services.vector_store import vector_store
from app.services.reranker import reranker

logger = logging.getLogger(__name__)

NO_CONTEXT_REPLY = (
    "I couldn't find relevant information in the course materials for this question. "
    "Try rephrasing your question or uploading more relevant files to this group."
)

LANGUAGE_INSTRUCTIONS = {
    "fr": "Respond entirely in French.",
    "ar": "Respond entirely in Arabic.",
    "es": "Respond entirely in Spanish.",
    "en": "Respond entirely in English.",
    "auto": "Respond in the same language the user used in their question.",
}


class RAGService:

    async def query(
        self,
        group_id: str,
        user_message: str,
        chat_history: list[dict],
        language: str = "auto",
    ) -> AsyncGenerator[dict, None]:
        """
        Full RAG pipeline. Yields dicts:
          {"type": "token",       "content": "word "}
          {"type": "citations",   "data": [...]}
          {"type": "suggestions", "data": ["q1", "q2", "q3"]}
          {"type": "done"}
          {"type": "error",       "content": "message"}
        """
        try:
            # 1. Rewrite query for better retrieval
            rewritten = await ai_service.rewrite_query(user_message, chat_history)
            logger.debug(f"Rewritten query: {rewritten!r}")

            # 2. Embed rewritten query
            embeddings = await ai_service.embed_texts([rewritten], input_type="query")
            query_embedding = embeddings[0]

            # 3. Retrieve top-8 chunks from ChromaDB
            raw_chunks = vector_store.query(
                group_id=group_id,
                query_embedding=query_embedding,
                top_k=8,
                min_score=0.4,
            )
            logger.info(f"Semantic search retrieved {len(raw_chunks)} chunks for query '{rewritten}'")
            if raw_chunks:
                logger.debug(f"Top similarity scores: {[round(c.get('similarity_score', 0), 3) for c in raw_chunks[:3]]}")

            if not raw_chunks:
                logger.warning(f"No chunks found for group {group_id} after semantic search. Rewritten query: '{rewritten}'")
                yield {"type": "token", "content": NO_CONTEXT_REPLY}
                yield {"type": "done"}
                return

            # 4. Rerank → keep top 5
            top_chunks = reranker.rerank(rewritten, raw_chunks, top_k=5)

            # 5. Build context string with source headers
            context_parts = []
            for i, chunk in enumerate(top_chunks):
                meta = chunk["metadata"]
                header = f"[Source {i+1}: {meta.get('file_name', 'Unknown')}, Page {meta.get('page_number', '?')}]"
                context_parts.append(f"{header}\n{chunk['text']}")
            context = "\n\n---\n\n".join(context_parts)

            # 6. Build system prompt
            system_prompt = self._build_system_prompt(context, language)

            # 7. Build messages (system + last 10 history turns + current message)
            history_slice = chat_history[-10:] if len(chat_history) > 10 else chat_history
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history_slice)
            messages.append({"role": "user", "content": user_message})

            # 8. Stream from AI
            full_response = ""
            stream = await ai_service.chat_completion(
                messages=messages,
                stream=True,
                temperature=0.5,
                max_tokens=3000,
            )
            async for token in stream:
                full_response += token
                yield {"type": "token", "content": token}

            # 9. Build citations from top chunks
            citations = [
                {
                    "file_name": c["metadata"].get("file_name", "Unknown"),
                    "page": c["metadata"].get("page_number", 1),
                    "excerpt": c["text"][:200] + ("..." if len(c["text"]) > 200 else ""),
                    "file_id": c["metadata"].get("file_id", ""),
                    "chunk_index": c["metadata"].get("chunk_index", 0),
                    "similarity_score": round(c.get("similarity_score", 0), 3),
                }
                for c in top_chunks
            ]
            yield {"type": "citations", "data": citations}

            # 10. Generate follow-up suggestions
            suggestions = await self._generate_suggestions(
                user_message, full_response, language
            )
            yield {"type": "suggestions", "data": suggestions}

            yield {"type": "done"}

        except Exception as e:
            logger.error(f"RAG query error for group {group_id}: {e}")
            yield {"type": "error", "content": "An error occurred. Please try again."}

    def _build_system_prompt(self, context: str, language: str) -> str:
        lang_instruction = LANGUAGE_INSTRUCTIONS.get(
            language, LANGUAGE_INSTRUCTIONS["auto"]
        )
        return f"""You are an AI tutor for an educational platform called StudyForge.
Your role is to help students understand their course material.

STRICT RULES — you must follow these without exception:
1. Answer ONLY using the course material provided in the CONTEXT section below.
2. Do NOT use any knowledge from your training data that is not present in the context.
3. If the answer is not in the context, say exactly:
   "I couldn't find this in the uploaded course materials. Try asking about topics covered in your files."
4. Always reference your sources inline using the format: (Source: filename, Page X)
5. Be clear, educational, and thorough in your explanations.
6. {lang_instruction}

COURSE MATERIAL CONTEXT:
{context}

Remember: Base your answer solely on the above context."""

    async def _generate_suggestions(
        self, question: str, answer: str, language: str
    ) -> list[str]:
        """Generate 3 follow-up questions based on the Q&A."""
        lang = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["auto"])
        try:
            result = await ai_service.generate_structured_json(
                prompt=(
                    f"A student asked: '{question}'\n"
                    f"The AI answered: '{answer[:500]}'\n\n"
                    f"Generate exactly 3 short follow-up questions the student might ask next. "
                    f"{lang}\n"
                    f"Return a JSON array of 3 strings only. Example: [\"What is X?\", \"How does Y work?\", \"Why is Z important?\"]"
                ),
                schema_description="array of 3 question strings",
                max_tokens=256,
            )
            if isinstance(result, list) and len(result) >= 3:
                return result[:3]
        except Exception as e:
            logger.warning(f"Could not generate suggestions: {e}")
        return ["Can you explain this in simpler terms?", "Can you give an example?", "What should I study next?"]


# Singleton
rag_service = RAGService()
