# StudyForge — Service Prompt Fixes + Vision PDF Support

## Context
You are fixing specific, identified bugs and quality issues across 6 backend service files. You are also adding a vision processing path to `file_processor.py` for PDFs that contain diagrams, drawings, and figures (like math workbooks, science textbooks, geometry exercises).

Do not refactor anything beyond what is listed. Do not rename functions, change APIs, or restructure files. Every fix is surgical.

---

## Step 0 — Read before touching anything

```bash
cat backend/app/services/ai_service.py
cat backend/app/services/rag_service.py
cat backend/app/services/flashcard_service.py
cat backend/app/services/exam_service.py
cat backend/app/services/slide_service.py
cat backend/app/services/learning_path_service.py
cat backend/app/services/file_processor.py
```

Read all 7 files completely before making any change.

---

## Fix 1 — `ai_service.py`: Temperature values

**Problem:** `generate_structured_json` uses `temperature=0.4` — too high for deterministic JSON output, causing malformed responses that trigger the 3-attempt retry loop unnecessarily. Content moderation uses `max_tokens=10` which is too tight if the model emits any preamble.

**Fix:** Find the `generate_structured_json` method. Change its temperature to `0.1`. Find the content moderation method. Change `max_tokens` from `10` to `20`. Add a strip + case-normalisation step to the moderation response parser so it handles " SAFE\n" and "The content is: UNSAFE" reliably:

```python
# In content moderation response parsing, replace whatever exists with:
raw = response_text.strip().upper()
if "UNSAFE" in raw:
    return "unsafe"
return "safe"
```

**Verification:** After your change, search for all `temperature=` values in `ai_service.py` and confirm:
- `generate_structured_json`: `0.1`
- `rewrite_query`: stays at `0.3` (do not change)
- `chat_completion` default: stays as-is (caller controls it)

---

## Fix 2 — `rag_service.py`: Four separate issues

### Fix 2a — Temperature

**Problem:** The call to `ai_service.chat_completion` in `rag_service.py` passes `temperature=0.5`. An educational tutor must be consistent and faithful to source material. At 0.5, students get different answers to the same question on different runs.

**Fix:** Change the single `temperature=0.5` argument to `temperature=0.25`.

### Fix 2b — Rule 2 in the system prompt

**Problem:** Current Rule 2 says: `"Do NOT use any knowledge from your training data that is not present in the context."` This is unenforceable — the model cannot distinguish training knowledge from context. Worse, it causes the model to refuse to explain concepts it understands when context only partially covers them.

**Fix:** In `_build_system_prompt`, replace Rule 2 entirely. The new text:

```
2. Prioritize the provided context. When the context is sufficient, derive your answer 
   entirely from it and cite the sources. When the context is insufficient to fully 
   answer the question, say so clearly — explain what is missing — then supplement 
   with general knowledge only as needed to avoid leaving the student with nothing.
```

Keep all other rules exactly as they are. Only replace rule 2's text.

### Fix 2c — Context position (lost-in-middle problem)

**Problem:** The context block is appended at the bottom of a long system message after 6 rules. For long documents, transformer attention degrades on content at the end of a long system prompt.

**Fix:** Restructure `_build_system_prompt` so it returns only the rules (without the context). Move context injection into the message list in `query()`. Replace:

```python
# BEFORE (roughly):
system_prompt = self._build_system_prompt(context, language)
messages = [{"role": "system", "content": system_prompt}]
messages.extend(history_slice)
messages.append({"role": "user", "content": user_message})
```

With:

```python
# AFTER:
rules_prompt = self._build_system_prompt(language)  # no context arg
messages = [
    {"role": "system", "content": rules_prompt},
    {"role": "user",  "content": f"COURSE MATERIAL FOR THIS SESSION:\n\n{context}"},
    {"role": "assistant", "content": "Understood. I will answer based on this material."},
]
messages.extend(history_slice)
messages.append({"role": "user", "content": user_message})
```

Update `_build_system_prompt` signature to `(self, language: str) -> str` and remove the context interpolation from the return string. Remove the `COURSE MATERIAL CONTEXT:` section from the returned string entirely. Keep all 6 rules.

### Fix 2d — Suggestions use truncated answer

**Problem:** `_generate_suggestions` passes `answer[:500]` to the prompt. A 3000-token response has most of its substance after character 500. Follow-up suggestions end up generic ("Can you give an example?") instead of topic-specific.

**Fix:** In `_generate_suggestions`, replace `answer[:500]` with a smarter extraction:

```python
# Extract beginning and end — captures intro + conclusion concepts
if len(answer) > 800:
    answer_excerpt = answer[:300] + "\n...\n" + answer[-400:]
else:
    answer_excerpt = answer
```

Update the prompt string to use `answer_excerpt` instead of `answer[:500]`.

---

## Fix 3 — `flashcard_service.py`: Three issues

### Fix 3a — Remove "verbatim quote" instruction

**Problem:** `source_passage` is instructed to be a "verbatim short excerpt". The model does not have the source text memorized — it fabricates plausible-sounding passages that look correct but are not. This is a hallucination instruction.

**Fix:** In `_build_generation_prompt`, find the line in `_CARD_SCHEMA` (or in the prompt string) that says `verbatim short excerpt` or `verbatim quote`. Replace with:

```
"source_passage": a short passage closely paraphrased from the material above 
— must reflect content actually present in the provided text, not invented
```

### Fix 3b — Add concrete bad/good example to prompt

**Problem:** The current rule "front must be a clear, specific question or term (not vague like 'What is X?')" uses a "What is X?" style as the bad example, which is itself a "What is X?" question — contradictory. No positive example is given.

**Fix:** In `_build_generation_prompt`, replace the current rule about front quality with:

```
- front: must be specific and testable. 
  BAD:  "What is entropy?"
  GOOD: "What happens to the available energy in a closed system as entropy increases?"
  BAD:  "What is photosynthesis?"  
  GOOD: "Which molecule is produced by photosynthesis that plants use for energy storage?"
```

Remove the existing "(not vague like 'What is X?')" phrasing entirely.

### Fix 3c — Post-generation deduplication

**Problem:** The prompt says "Do NOT repeat the same concept twice" but the model cannot reliably track its own output mid-generation. Duplicate-concept cards appear regularly.

**Fix:** After `raw_cards = await ai_service.generate_structured_json(...)` and before the validation loop, add a dedup function:

```python
def _dedup_cards(raw_cards: list) -> list:
    """Remove cards whose front is >75% similar to a previously seen front."""
    seen_fronts: list[str] = []
    deduped = []
    for card in raw_cards:
        if not isinstance(card, dict):
            continue
        front = card.get("front", "").lower().strip()
        if not front:
            continue
        # Simple token overlap check — no external library needed
        front_tokens = set(front.split())
        is_duplicate = False
        for seen in seen_fronts:
            seen_tokens = set(seen.split())
            if not seen_tokens:
                continue
            overlap = len(front_tokens & seen_tokens) / max(len(front_tokens), len(seen_tokens), 1)
            if overlap > 0.75:
                is_duplicate = True
                break
        if not is_duplicate:
            seen_fronts.append(front)
            deduped.append(card)
    return deduped

raw_cards = _dedup_cards(raw_cards)
```

Place `_dedup_cards` as a module-level function (alongside `_sm2_next`, `_sample_chunks_for_cards`, etc.).

---

## Fix 4 — `exam_service.py`: Two issues

### Fix 4a — Distractor quality instruction

**Problem:** The generation prompt does not instruct the model to make MCQ distractors plausible. The model produces obviously wrong distractors that make exams trivially easy.

**Fix:** Find the MCQ section of the exam generation prompt. Add this rule to the prompt for all question types that have options/distractors:

```
DISTRACTOR RULES (MCQ only):
- Each distractor must be plausible — same domain, same specificity level as the correct answer.
- Distractors must be grammatically parallel to the correct answer.
- Never use "None of the above", "All of the above", or obviously absurd options.
- A student who has partially studied should not be able to eliminate distractors by common sense alone.
```

### Fix 4b — Generate one type at a time

**Problem:** If the prompt requests mixed types in one call (e.g. "3 MCQ + 2 true-false + 2 fill-blank"), the model sometimes formats MCQ as true-false or produces incorrect schemas for edge-case types.

**Fix:** Find where `generate_structured_json` is called for exam questions. If it's a single call with all types mixed, split it into separate calls per type using `asyncio.gather`:

```python
# Instead of one call with all types mixed:
tasks = []
for q_type, count in type_counts.items():
    tasks.append(
        ai_service.generate_structured_json(
            prompt=_build_prompt_for_type(q_type, count, context, difficulty, language),
            schema_description=_SCHEMA_FOR_TYPE[q_type],
            max_tokens=4096,
        )
    )
results = await asyncio.gather(*tasks, return_exceptions=True)
all_questions = []
for result in results:
    if isinstance(result, Exception):
        logger.warning(f"Question generation partial failure: {result}")
        continue
    if isinstance(result, list):
        all_questions.extend(result)
```

Build `_build_prompt_for_type(q_type, count, context, difficulty, language)` as a helper that returns a type-specific prompt. Build `_SCHEMA_FOR_TYPE` as a dict mapping each type to its schema description string. This replaces however the current code structures the single mixed call. Keep the existing 3-attempt JSON retry in `generate_structured_json` — it still applies per-call.

---

## Fix 5 — `slide_service.py`: Speaker notes repetition

**Problem:** Speaker notes in generated slides tend to restate the bullet text rather than adding context, examples, or teaching guidance.

**Fix:** Find the slide enrichment prompt (the one that generates per-slide content including `speaker_notes`). Add this constraint to the speaker notes instruction:

```
speaker_notes: Teaching script for the instructor (3-5 sentences).
RULE: Speaker notes must NOT restate the bullets. They must add:
  - A concrete real-world example or analogy
  - A common student misconception to address
  - A transition cue or teaching tip
  If you find yourself repeating a bullet point, stop and write something different.
```

---

## Fix 6 — `learning_path_service.py`: Word count → depth instruction

**Problem:** The module content prompt specifies "200–400 word teaching prose". Models do not count words accurately and produce 150 or 600 words while believing they followed the instruction.

**Fix:** Find the module enrichment prompt (the one that generates `content_markdown`). Replace any mention of word count ("200–400 words", "200 to 400 words", etc.) with:

```
Write teaching prose that covers the concept thoroughly enough that a student 
with no prior knowledge of this topic could understand it after reading once.
Include:
  - One concrete real-world example
  - One common misconception and why it is wrong  
  - A self-check question the student can use to test their understanding
The prose must flow as connected paragraphs, not bullet points.
```

Keep the "bridge to next module" instruction exactly as it is — do not remove it.

---

## Fix 7 — `file_processor.py`: Vision path for visual-heavy PDFs

**Problem:** Many educational PDFs — math workbooks, science textbooks, geometry exercises — contain geometric drawings, diagrams, and figures that are vector graphics drawn as PDF page operators. These are invisible to `pdfplumber` text extraction and to `pdfimages`. The only way to read them is to rasterize the page and send it to a vision-capable AI model.

A real example: a Moroccan 1AC math workbook with triangles, quadrilaterals, coordinate planes, and construction exercises. Text extraction captures lesson titles and exercise text but misses 60%+ of the actual learning content — all the visual geometry.

**Fix:** Add a vision processing path to `file_processor.py`. This adds a new dependency: `pdf2image` (which wraps `pdftoppm`). Install it:

```bash
pip install pdf2image --break-system-packages
```

Add this function to `file_processor.py`:

```python
import io
import base64
from pdf2image import convert_from_path


def _page_is_visual_heavy(page_text: str, page_height_pts: float) -> bool:
    """
    Heuristic: if a page has very little extractable text relative to its size,
    it likely has significant visual content (diagrams, figures, drawings).
    """
    words = len(page_text.split()) if page_text else 0
    # A typical text-only page at this size has 200+ words
    # Threshold: fewer than 60 words on a full page = visual-heavy
    return words < 60


async def _describe_visual_page(
    pdf_path: str,
    page_number: int,  # 1-based
    file_name: str,
) -> str:
    """
    Rasterizes a single PDF page and sends it to the vision model for description.
    Returns a text description suitable for indexing in ChromaDB.
    """
    try:
        images = convert_from_path(
            pdf_path,
            dpi=150,
            first_page=page_number,
            last_page=page_number,
        )
        if not images:
            return ""

        # Convert PIL image to base64 JPEG
        img = images[0]
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        description = await ai_service.describe_image(
            image_b64=img_b64,
            media_type="image/jpeg",
            prompt=(
                f"This is page {page_number} of the educational document '{file_name}'. "
                "Describe all visual content on this page in detail: "
                "geometric figures (name, labels, measurements), diagrams, tables, charts, "
                "drawings, and any text that appears in or near figures. "
                "Be precise and complete — a student will search for this content. "
                "Do not describe page decorations, borders, or background colors."
            ),
        )
        return description

    except Exception as e:
        logger.warning(f"Vision description failed for page {page_number}: {e}")
        return ""
```

**Add `describe_image` to `ai_service.py`:**

Find the `OpenAICompatProvider` class (or equivalent). Add this method:

```python
async def describe_image(
    self,
    image_b64: str,
    media_type: str = "image/jpeg",
    prompt: str = "Describe this image in detail.",
) -> str:
    """
    Send a base64-encoded image to the vision model and return a text description.
    Uses the same provider as chat_completion.
    """
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{image_b64}",
                        "detail": "high",
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }
    ]
    response = await self.chat_completion(
        messages=messages,
        stream=False,
        temperature=0.1,
        max_tokens=1000,
    )
    # response is a string when stream=False
    return response.strip() if isinstance(response, str) else ""
```

Add a public wrapper on `ai_service` (the singleton):
```python
async def describe_image(self, image_b64: str, media_type: str, prompt: str) -> str:
    return await self._active_provider.describe_image(image_b64, media_type, prompt)
```

**Wire it into the PDF extraction loop in `file_processor.py`:**

Find where PDF pages are iterated (the loop over `pdf.pages` or similar). After extracting text for each page, add:

```python
# After extracting page_text for this page:
if _page_is_visual_heavy(page_text, page.height):
    logger.info(f"Page {page_num} of '{file_name}' is visual-heavy — running vision description")
    visual_description = await _describe_visual_page(
        pdf_path=local_file_path,
        page_number=page_num,
        file_name=file_name,
    )
    if visual_description:
        # Prepend visual description to whatever text was extracted
        # so both are chunked and indexed together
        page_text = f"[Visual content description]\n{visual_description}\n\n[Text content]\n{page_text}"
```

The combined text then flows into the existing chunking and embedding pipeline without any other changes.

**Important:** the local file path is needed for `convert_from_path`. Make sure the Celery task has already downloaded the file from S3 to a temp path before calling the processor. If this is already done (the task downloads first), pass that path through. If the processor currently works with a stream or bytes, add a `tempfile.NamedTemporaryFile` write step before calling `convert_from_path`.

---

## Fix 8 — Verify all temperature changes

After all fixes, run this check:

```bash
grep -n "temperature=" backend/app/services/ai_service.py
grep -n "temperature=" backend/app/services/rag_service.py
```

Confirm:
- `generate_structured_json` in `ai_service.py`: `0.1`
- `chat_completion` call in `rag_service.py`: `0.25`
- `rewrite_query` in `ai_service.py`: `0.3` (unchanged)

---

## Fix 9 — Write a fixes log

Create `docs/prompt_fixes.md`:

```markdown
# Prompt and service fixes applied

## ai_service.py
- generate_structured_json: temperature 0.4 → 0.1
- content moderation: max_tokens 10 → 20, response parser normalised
- added: describe_image() method for vision processing

## rag_service.py
- chat_completion: temperature 0.5 → 0.25
- Rule 2 rewritten: "do not use training data" → "prioritize context, supplement when insufficient"
- Context moved from system message bottom to user message (fixes lost-in-middle)
- Suggestions: answer[:500] → beginning + end extraction

## flashcard_service.py
- source_passage: "verbatim" removed, replaced with paraphrase instruction
- Front quality example: bad/good concrete pair added
- _dedup_cards() added: token-overlap deduplication post-generation

## exam_service.py
- MCQ distractor quality rules added to prompt
- Generation split by question type using asyncio.gather

## slide_service.py
- Speaker notes constraint added: must not restate bullets

## learning_path_service.py
- Word count (200-400) replaced with depth + content requirements

## file_processor.py
- Vision path added for visual-heavy PDF pages
- _page_is_visual_heavy() heuristic (< 60 words threshold)
- _describe_visual_page() rasterizes at 150 DPI, calls describe_image()
- Visual description prepended to page text before chunking
```

---

## Rules

- Do not change function signatures visible to callers (routes, tasks) unless explicitly listed above
- Do not add new pip packages beyond `pdf2image` (already listed)
- Do not change the SM-2 algorithm — it is correct as-is
- Do not change the reranker — it is correct as-is
- Do not change the vector_store — it is correct as-is
- If a fix references code you cannot find (e.g. the exam prompt is structured differently than expected), adapt the fix to match the actual code structure while preserving the intent exactly as described
- After all fixes: run `python -c "from app.services.ai_service import ai_service; print('OK')"` from the backend directory to confirm no import errors
