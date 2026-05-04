import asyncio
import json
import logging
import time
from typing import AsyncGenerator

from openai import OpenAI, RateLimitError, APIError

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.client = OpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
        )
        self.chat_model = settings.NVIDIA_CHAT_MODEL
        self.embed_model = settings.NVIDIA_EMBED_MODEL

    async def chat_completion(
        self,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str | AsyncGenerator[str, None]:
        """
        Call DeepSeek via NVIDIA API.
        Non-streaming: returns complete text string.
        Streaming: returns AsyncGenerator yielding text chunks.
        Retries up to 3 times with exponential backoff on 429.
        """
        kwargs = dict(
            model=self.chat_model,
            messages=messages,
            temperature=temperature,
            top_p=0.95,
            max_tokens=max_tokens,
            stream=stream,
        )

        if stream:
            return self._stream_completion(kwargs)
        else:
            return await self._complete_with_retry(kwargs)

    async def _complete_with_retry(self, kwargs: dict) -> str:
        for attempt in range(3):
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.chat.completions.create(**kwargs),
                )
                return response.choices[0].message.content or ""
            except RateLimitError:
                if attempt == 2:
                    raise
                wait = 2 ** attempt
                logger.warning(f"Rate limited by NVIDIA API, retrying in {wait}s...")
                await asyncio.sleep(wait)
            except APIError as e:
                if attempt == 2:
                    raise
                logger.warning(f"NVIDIA API error: {e}, retrying...")
                await asyncio.sleep(1)

    async def _stream_completion(self, kwargs: dict) -> AsyncGenerator[str, None]:
        def _sync_stream():
            return self.client.chat.completions.create(**kwargs)

        loop = asyncio.get_event_loop()
        stream = await loop.run_in_executor(None, _sync_stream)
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed_texts(
        self, texts: list[str], input_type: str = "passage"
    ) -> list[list[float]]:
        """
        Embed texts using NVIDIA nv-embedqa-e5-v5.
        input_type: 'passage' for indexing documents, 'query' for retrieval queries.
        Batches in groups of 96 (NVIDIA limit).
        """
        if not texts:
            return []

        all_embeddings = []
        batch_size = 96

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for attempt in range(3):
                try:
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda b=batch: self.client.embeddings.create(
                            input=b,
                            model=self.embed_model,
                            encoding_format="float",
                            extra_body={"input_type": input_type, "truncate": "END"},
                        ),
                    )
                    batch_embeddings = [item.embedding for item in response.data]
                    all_embeddings.extend(batch_embeddings)
                    break
                except RateLimitError:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2 ** attempt)
                except Exception as e:
                    logger.error(f"Embedding error on batch {i}: {e}")
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)

        return all_embeddings

    async def rewrite_query(self, query: str, chat_history: list[dict]) -> str:
        """
        Rewrite an ambiguous query as a clear standalone search question.
        Uses the last 3 turns of chat history for context.
        """
        recent_history = chat_history[-6:] if len(chat_history) > 6 else chat_history
        history_str = ""
        if recent_history:
            history_str = "\n".join(
                f"{m['role'].upper()}: {m['content'][:200]}" for m in recent_history
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a query optimizer for an educational search engine. "
                    "Rewrite the user's question as a clear, standalone, search-optimized query "
                    "that captures the full intent — even if the original question references "
                    "prior conversation. Return ONLY the rewritten query, nothing else. "
                    "No explanation, no punctuation at the end."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Conversation history:\n{history_str}\n\n"
                    f"Current question: {query}\n\n"
                    f"Rewritten standalone query:"
                ),
            },
        ]

        result = await self._complete_with_retry(
            dict(
                model=self.chat_model,
                messages=messages,
                temperature=0.3,
                max_tokens=256,
                stream=False,
            )
        )
        rewritten_query = result.strip() or query
        logger.debug(f"Query rewrite: '{query}' → '{rewritten_query}'")
        return rewritten_query

    async def generate_structured_json(
        self, prompt: str, schema_description: str, max_tokens: int = 8192
    ) -> dict | list:
        """
        Ask the model to return valid JSON matching a described schema.
        Retries up to 2 extra times if JSON parse fails.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a JSON generation assistant. "
                    "You must respond with ONLY valid JSON — no explanation, "
                    "no markdown code blocks, no backticks. "
                    f"The JSON must match this schema: {schema_description}. "
                    "Start your response with {{ or [ immediately."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        for attempt in range(3):
            try:
                raw = await self._complete_with_retry(
                    dict(
                        model=self.chat_model,
                        messages=messages,
                        temperature=0.4,
                        max_tokens=max_tokens,
                        stream=False,
                    )
                )
                # Strip markdown code fences if model adds them anyway
                raw = raw.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()
                return json.loads(raw)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse failed (attempt {attempt + 1}): {e}")
                if attempt == 2:
                    raise ValueError(f"Failed to get valid JSON after 3 attempts: {e}")
                messages.append(
                    {
                        "role": "user",
                        "content": "Your previous response was not valid JSON. Please try again and return ONLY the JSON.",
                    }
                )

    async def moderate_content(self, text: str) -> bool:
        """Returns True if content is safe for an educational platform."""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a content moderation assistant for an educational platform. "
                    "Respond with ONLY 'safe' or 'unsafe'."
                ),
            },
            {
                "role": "user",
                "content": f"Is this text appropriate for students? Text: {text[:500]}",
            },
        ]
        try:
            result = await self._complete_with_retry(
                dict(
                    model=self.chat_model,
                    messages=messages,
                    temperature=0.0,
                    max_tokens=10,
                    stream=False,
                )
            )
            return "unsafe" not in result.lower()
        except Exception:
            return True  # Fail open on moderation errors


# Singleton
ai_service = AIService()
