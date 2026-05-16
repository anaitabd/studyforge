# Prompt and service fixes applied

## ai_service.py
- `generate_structured_json`: temperature 0.4 → 0.1
- `moderate_content`: max_tokens 10 → 20, response parser normalised (strip + upper, "UNSAFE" in raw)
- Added: `describe_image()` method for vision processing (base64 image → text description)

## rag_service.py
- `chat_completion` call: temperature 0.5 → 0.25
- Rule 2 rewritten: "do not use training data" → "prioritize context, supplement with general knowledge when insufficient"
- Context moved from system message bottom to a dedicated user message (fixes lost-in-middle attention degradation)
- `_generate_suggestions`: `answer[:500]` → beginning (300 chars) + end (400 chars) extraction for long answers

## flashcard_service.py
- `_CARD_SCHEMA`: `source_passage` changed from "verbatim short excerpt" to "closely paraphrased passage — must reflect content actually present, not invented"
- Front quality rule: vague bad-example replaced with concrete BAD/GOOD pairs (entropy, photosynthesis)
- `_dedup_cards()` added: token-overlap deduplication (>75% threshold) run post-generation before persistence

## exam_service.py
- MCQ distractor quality rules added to `_build_generation_prompt` for mcq_single, mcq_multiple, fill_blank types
- Generation refactored to use `asyncio.gather` with one task per question type (prevents schema confusion; extensible to future mixed-type exams)

## slide_service.py
- Speaker notes constraint added to `_build_enrich_prompt`: must NOT restate bullets; must add real-world example/analogy, misconception, or transition cue

## learning_path_service.py
- Word count instruction ("200–400 words") replaced with depth + content requirements: real-world example, common misconception, self-check question, connected paragraphs
- "Next step:" bridge instruction preserved as-is

## file_processor.py
- `_page_is_visual_heavy()` added: heuristic returning True when a PDF page has < 60 words
- `_describe_visual_page()` added: async, rasterizes page at 150 DPI via pdf2image, calls `ai_service.describe_image()`
- `FileProcessor._extract_pdf_with_vision()` added: async PDF extraction with per-page vision fallback
- `FileProcessor.extract_text_async()` added: public async entry point; routes PDF through vision path, other types through existing sync extraction
- Visual description is prepended to page text before chunking so both visual and textual content are indexed together
- Dependency added: `pdf2image` (wraps pdftoppm)
