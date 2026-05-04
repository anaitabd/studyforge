# Learning Path System Quality Audit (StudyForge)

## 1) Overall Score
- **Quality score:** 78/100
- **Readiness:** Good (not yet production-ready)

## 2) Critical Issues
1. **Weak structural QA at generation time**: learning paths were accepted even when module duration/objectives were inconsistent.
2. **RAG-grounding risk on source pages**: modules could persist with empty/invalid `source_pages`, reducing traceability to source material.
3. **Difficulty jumps not explicitly constrained**: generated module effort could jump sharply between consecutive modules.
4. **Assessment linkage gap**: platform supports exams and flashcards but no unified, explicit mapping contract from item → source chunk id in this service.

## 3) Improvements Applied
- Added module progression validation (`_validate_module_progression`) to normalize module lengths/objectives/concepts and reduce abrupt complexity jumps.
- Added source-page normalization (`_normalize_source_pages`) with fallback derivation from retrieved chunks.
- Preserved retrieved module chunks in generation pipeline long enough to improve source-page grounding before persistence.

## 4) Optimized Learning Path Blueprint
1. Foundations (Remember/Understand) — 30-60 min total
2. Core Concepts (Understand/Apply) — 45-90 min
3. Guided Applications (Apply/Analyze) — 45-120 min
4. Advanced & Edge Cases (Analyze/Evaluate) — 45-120 min
5. Capstone/Transfer (Evaluate/Create) — 60-180 min

## 5) Improved QCM Pattern (RAG-safe)
For each question item, require:
- stem
- options[]
- answer_key
- explanation
- **source_chunk_ids[]**
- source_excerpt (short)

## 6) Flashcard Optimization Pattern
- Maintain 40/40/20 split:
  - 40% definitions
  - 40% applied concepts
  - 20% formulas/facts/procedures
- Enforce one concept per card and deduplicate by normalized front text.

## 7) Advanced Enhancements
- Adaptive unlocks by mastery confidence, not only completion sequence.
- Practical labs/case mini-projects every 2-3 modules.
- Cohort analytics: time-on-module, failure hotspots, confidence drift.
