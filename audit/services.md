# Services Audit — StudyForge

Each service is audited against the spec requirements documented during the read phase.

---

## 1. `ai_service.py`

**File:** `apps/api/app/services/ai_service.py`

| Requirement | Status | Detail |
|---|---|---|
| Four providers: OpenAICompat, NVIDIA, Ollama, Bedrock | PASS | All four present and selectable via `settings.AI_PROVIDER` |
| OpenAICompat uses Responses API (`client.responses.create`) | PASS | Confirmed; NOT using `chat.completions.create` |
| `generate_structured_json` retries on JSON decode failure | PASS | 3 attempts with `json.JSONDecodeError` catch |
| Backoff `[2, 5, 10]` seconds with jitter | PASS | Matches spec exactly |
| `embed_texts` batches at 96 items | PASS | Batch size = 96 in embed loop |
| Streaming yields token chunks | PASS | Async generator yielding string tokens |

**Overall: PASS — no issues found.**

---

## 2. `rag_service.py`

**File:** `apps/api/app/services/rag_service.py`

| Requirement | Status | Detail |
|---|---|---|
| Pipeline: rewrite → embed → vector search → rerank → LLM stream | PASS | All five stages present in order |
| `min_score=0.4` filter on vector store query | PASS | Confirmed |
| Cross-encoder reranker top_k=5 | PASS | Confirmed |
| Yields `{type:token}`, `{type:citations}`, `{type:suggestions}`, `{type:done}` | PASS | All four event types present |
| Messages persisted after streaming | PARTIAL | rag_service itself does NOT persist; persistence is done inside `chat.py` endpoint using `async with db.begin()` after stream completes. Spec requirement is technically met but the pattern is fragile — if the client disconnects before stream end, the AI message may not be saved. |
| Rate limiter applied | PASS | `rate_limiter` dependency injected in chat endpoint |

**Issues:**
- **Fragile persistence pattern**: AI message save is in the endpoint, inside a nested `async with db.begin()`. If client disconnects mid-stream the message is lost. This is an architectural concern, not a bug in isolation.

---

## 3. `file_processor.py`

**File:** `apps/api/app/services/file_processor.py`

| Requirement | Status | Detail |
|---|---|---|
| PDF parsing: pypdfium2 primary, pdfplumber fallback | PASS | Confirmed |
| DOCX: python-docx | PASS | Confirmed |
| PPTX: python-pptx | PASS | Confirmed |
| TXT: plain open() | PASS | Confirmed |
| Recursive character splitter | PASS | Separators `["\n\n", "\n", ". ", " "]` |
| chunk_size=1024 tokens, overlap=256 | PASS | Confirmed |
| "Sentence boundary" chunking | PARTIAL | Spec says "sentence boundaries"; actual separators give paragraph→newline→sentence→word priority. Functional but not pure sentence splitting. |
| Batch upsert to vector store in 500-item batches | PASS | Confirmed (`BATCH_SIZE=500`) |

**Overall: PASS with minor deviation from pure sentence boundary spec.**

---

## 4. `exam_service.py`

**File:** `apps/api/app/services/exam_service.py`

| Requirement | Status | Detail |
|---|---|---|
| Four question types: mcq_single, mcq_multiple, true_false, fill_blank | PASS | All four with separate schemas |
| Schema validation on parsed questions | PASS | Validates required keys per type |
| Fallback if question type fails to parse | FAIL | Malformed questions are silently skipped. Spec requires a fallback (e.g., degrade to simpler type). No recovery path — question is just dropped. |
| Difficulty levels: easy, medium, hard, mixed | PASS | All four accepted |
| question_count enforced | PASS | Confirmed |

**Issues:**
- **Silent skip on malformed questions**: A question that fails schema validation is dropped without substitution. If many questions fail (e.g., model returns wrong format), the exam could end up with fewer questions than requested.

---

## 5. `flashcard_service.py`

**File:** `apps/api/app/services/flashcard_service.py`

| Requirement | Status | Detail |
|---|---|---|
| SM-2 algorithm | PASS | Matches classic SM-2 |
| ease_factor starts at 2.5 | PASS | Default 2.5 |
| Quality scale 0–5 | PASS | Confirmed |
| Interval schedule: rep1→1d, rep2→6d, rep3+→round(interval*ef) | PASS | Confirmed |
| ease_factor clamped at minimum 1.3 | PASS | `max(1.3, ...)` |
| Quality mapping: again=0, hard=2, good=4, easy=5 | PASS | Confirmed |
| `reps` field name | NOTE | Field is `reps` in DB model, but spec used `repetitions`. Frontend `use-flashcards.ts` uses `repetitions` — causing schema mismatch. |
| `interval_days` field name | NOTE | Field is `interval_days` in DB model, but frontend uses `interval` — schema mismatch. |

**Issues:**
- **Field name mismatch (backend correct, frontend wrong)**: `interval_days` vs `interval`, `reps` vs `repetitions`. See hooks.md for frontend fix needed.

---

## 6. `learning_path_service.py`

**File:** `apps/api/app/services/learning_path_service.py`

| Requirement | Status | Detail |
|---|---|---|
| Two-phase generation: outline → enrichment | PASS | Phase 1: `generate_structured_json` for outline; Phase 2: enrich each module |
| `asyncio.Semaphore(3)` for parallel enrichment | PASS | Confirmed Semaphore(3) |
| Module content as Markdown | PASS | `content_markdown` Text field |
| Both phases use `generate_structured_json` | PASS | Confirmed |

**Overall: PASS — fully matches spec.**

---

## 7. `slide_service.py`

**File:** `apps/api/app/services/slide_service.py`

| Requirement | Status | Detail |
|---|---|---|
| Three-phase generation: cluster outline → per-slide enrichment → PPTX export | PASS | All three phases present |
| `asyncio.Semaphore(4)` for slide enrichment | FAIL | Actual value: `SLIDE_ENRICH_CONCURRENCY = 1`. Spec requires Semaphore(4). This limits parallelism and increases generation time. |
| Deck status set to "ready" or "error" at end | PASS | Confirmed |
| PPTX generated and uploaded to S3 | PASS | Confirmed |
| `pptx_url` saved on SlideDeck | PASS | Confirmed |

**Issues:**
- **SLIDE_ENRICH_CONCURRENCY=1 (spec: 4)**: Slide enrichment runs one-at-a-time. For a 20-slide deck this means 20 sequential LLM calls instead of batches of 4. Generation time is roughly 4× slower than the spec target.

---

## 8. `notification_service.py`

**File:** `apps/api/app/services/notification_service.py`

| Requirement | Status | Detail |
|---|---|---|
| In-app DB row always created | PASS | Confirmed |
| Email dispatched only if `user.notif_email=True` | FAIL | `_dispatch_email` sends to any user with an email address. Does NOT check `notif_email` flag. All users receive emails regardless of preference. |
| WhatsApp dispatched only if `user.notif_whatsapp=True` | FAIL | `_dispatch_whatsapp` sends to any user with `wa_number`. Does NOT check `notif_whatsapp` flag. |
| WhatsApp restricted to `plan='school'` users | FAIL | No plan check in `_dispatch_whatsapp`. Any user with a WhatsApp number receives messages. |
| Notification deduplication for exam reminders | PASS | `check_exam_deadlines` checks for existing Notification rows before re-sending |

**Issues (3 bugs):**
1. Email ignores `notif_email` preference — every user with an email gets spammed.
2. WhatsApp ignores `notif_whatsapp` preference.
3. WhatsApp ignores `plan='school'` restriction.

---

## 9. `vector_store.py`

**File:** `apps/api/app/services/vector_store.py`

| Requirement | Status | Detail |
|---|---|---|
| ChromaDB HTTP client | PASS | Confirmed |
| `upsert_chunks(file_id, chunks, embeddings)` | PASS | Confirmed |
| `query(text, file_ids, min_score)` | PASS | Confirmed |
| `get_all_chunks_for_files(file_ids)` | PASS | Confirmed |
| Org-scoped collection: `org-{org_id}` | PASS | Confirmed |
| Individual collection: `user-{user_id}` | PASS | Confirmed |

**Overall: PASS — no issues found.**

---

## 10. `reranker.py`

**File:** `apps/api/app/services/reranker.py`

| Requirement | Status | Detail |
|---|---|---|
| Model: `cross-encoder/ms-marco-MiniLM-L-6-v2` | PASS | Confirmed |
| Fallback to similarity sort if model unavailable | PASS | Confirmed |
| Warmed up on API startup | PASS | `main.py` calls warm-up on `startup` event |

**Overall: PASS — no issues found.**

---

## 11. `storage_service.py`

**File:** `apps/api/app/services/storage_service.py`

| Requirement | Status | Detail |
|---|---|---|
| `upload_file(bytes, key, content_type)` | PASS | Confirmed |
| `download_file(key)` | PASS | Confirmed |
| `delete_file(key)` | PASS | Confirmed |
| `get_presigned_url(key, expires_in)` — GET | PASS | Confirmed; expires_in defaults to 3600 |
| `get_presigned_put_url(key)` — PUT for direct uploads | FAIL | **MISSING**: No presigned PUT method exists. Direct uploads go through the multipart endpoint in `files.py`. If a client needs to upload directly to S3 bypassing the API, there is no method. |
| Server-side encryption (AES256 or KMS) | PASS | `_build_encryption_args` handles both |
| Auto-create bucket when `S3_AUTO_CREATE_BUCKET=True` | PASS | Confirmed |
| Legacy R2 credential support | PASS | R2_* vars still accepted with deprecation warning |

**Issues:**
- **Missing `get_presigned_put_url`**: Spec lists this as required for direct client → S3 upload flows. Currently all uploads flow through the API server as multipart, which limits parallelism for large files.
