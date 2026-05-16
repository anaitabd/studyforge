# StudyForge — Complete Prompt Index

## All 28 prompts, organized by layer and run order

---

## LAYER 1 — Backend Foundation
Run these first. Everything else depends on them.

| # | File | Status | What it builds |
|---|---|---|---|
| BE-1 | `studyforge_claude_code_prompt.md` | ✅ Done | RBAC, TimescaleDB, Orgs, ChromaDB refactor, Cohorts, Assignments, Goals |
| BE-2 | `studyforge_service_fixes_prompt.md` | ✅ Done | Temperature fixes, RAG improvements, flashcard dedup, vision PDF |
| BE-3 | `prompt_4_moroccan_exam.md` | ✅ Done | Moroccan exam types, /20 grading, essay correction, construction photo |
| BE-4 | `prompt_be_graph_rag.md` | ✅ Done | Knowledge graph extraction, concept-based retrieval |
| BE-5 | `prompt_be_curriculum_parser.md` | ✅ Done | DS/DC/BAC document parser, similar exercise generator |
| BE-6 | `prompt_be_universal_curriculum.md` | ✅ Done | Universal education systems, certification formats, case studies, code exercises |
| BE-7 | `prompt_ma_primaire.md` | ✅ Done | Primary 1AP-6AP, CEP format, child-friendly questions |
| BE-8 | `prompt_ma_superieur_ofppt.md` | ✅ Done | University, Grandes Écoles, OFPPT vocational |
| **BE-9** | `prompt_be_gamification.md` | 🔴 Missing | XP, badges, achievements, daily challenges, leaderboards |
| **BE-10** | `prompt_be_live_classroom.md` | 🔴 Missing | WebSocket live quiz, Kahoot-style teacher tools, real-time collaboration |
| **BE-11** | `prompt_be_ocr_multimodal.md` | 🔴 Missing | Handwriting OCR, photo problem solving (Photomath-style) |
| **BE-12** | `prompt_be_notifications_smart.md` | 🔴 Missing | Smart reminders, spaced repetition alerts, WhatsApp deep integration |
| **BE-13** | `prompt_be_performance_security.md` | 🔴 Missing | Redis caching, DB indexes, rate limiting, security hardening |
| **BE-14** | `prompt_be_payments.md` | 🔴 Missing | Stripe subscriptions, Moroccan payment methods (CMI, CashPlus) |

---

## LAYER 2 — Frontend
Run after the backend prompts they depend on.

| # | File | Status | What it builds |
|---|---|---|---|
| FE-0 | `prompt_fe0_design_system.md` | ✅ Done | Design tokens, component patterns, UX rules |
| FE-1 | `prompt_fe1_audit.md` | ✅ Done | Gap matrix, missing hooks, TypeScript fixes |
| FE-2 | `prompt_fe2_exam_experience.md` | ✅ Done | 5 question types, /20 results, construction photo, IELTS mode |
| FE-3 | `prompt_fe3_individual_dashboard.md` | ✅ Done | KPI panel, goals, streaks, weak areas, score trend |
| FE-4 | `prompt_fe4_org_surface.md` | ✅ Done | Org admin, teacher live view, student tasks, members |
| FE-5 | `prompt_fe5_math_rendering.md` | ✅ Done | KaTeX, probability tables, exam document viewer, concept map |
| FE-6 | `prompt_fe6_universal_education.md` | ✅ Done | Universal level selector, code exercise UI, certification mode |
| **FE-7** | `prompt_fe_gamification.md` | 🔴 Missing | XP bar, badge showcase, daily challenge, leaderboard |
| **FE-8** | `prompt_fe_live_classroom.md` | 🔴 Missing | Live quiz player/host, real-time study room |
| **FE-9** | `prompt_fe_pwa_mobile.md` | 🔴 Missing | PWA manifest, service worker, offline mode, mobile nav |
| **FE-10** | `prompt_fe_accessibility_i18n.md` | 🔴 Missing | A11y, screen reader, Arabic/French/English UI toggle, dark mode |
| **FE-11** | `prompt_fe_social_sharing.md` | 🔴 Missing | WhatsApp sharing, peer challenges, content marketplace |
| **FE-12** | `prompt_fe_search_onboarding.md` | 🔴 Missing | Global search, proper onboarding flow, settings page |

---

## LAYER 3 — Audit & Review
Run last, after all features are merged.

| # | File | Status | What it builds |
|---|---|---|---|
| AUD-1 | `studyforge_fullstack_audit_prompt.md` | ✅ Done | Full backend-frontend gap closure |
| AUD-2 | `prompt_project_review.md` | ✅ Done | Complete technical review with priority fix list |

---

## Master run order

```
Phase 1 — Foundation (already done):
  BE-1 → BE-2 → BE-3 → BE-4 → BE-5

Phase 2 — Curriculum (already done):
  BE-6 → BE-7 → BE-8

Phase 3 — Engagement (build next):
  BE-9 (gamification) → FE-7 (gamification UI)
  BE-10 (live classroom) → FE-8 (live classroom UI)
  BE-11 (OCR) → no FE changes needed (uses existing file upload)

Phase 4 — Product quality:
  BE-12 (smart notifications)
  BE-13 (performance + security)
  FE-9 (PWA + mobile)
  FE-10 (accessibility + i18n)

Phase 5 — Growth:
  BE-14 (payments)
  FE-11 (social + sharing)
  FE-12 (search + onboarding)

Phase 6 — Frontend integration:
  FE-1 → FE-2 → FE-3 → FE-4 → FE-5 → FE-6

Phase 7 — Final validation:
  AUD-1 → AUD-2
```

---

## Competitive feature checklist

| Feature | Duolingo | Khan Academy | Quizlet | Photomath | Kahoot | StudyForge |
|---|---|---|---|---|---|---|
| Spaced repetition (SM-2) | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ Done |
| AI content generation | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ Done |
| RAG document chat | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Done |
| Gamification (XP/badges) | ✅ | ✅ | ✅ | ❌ | ✅ | 🔴 BE-9/FE-7 |
| Live classroom quiz | ❌ | ❌ | ❌ | ❌ | ✅ | 🔴 BE-10/FE-8 |
| Photo problem solving | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 BE-11 |
| Org/school management | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ Done |
| /20 Moroccan grading | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Done |
| Arabic RTL support | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 FE-10 |
| PWA/Offline | ✅ | ✅ | ✅ | ❌ | ❌ | 🔴 FE-9 |
| WhatsApp integration | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 BE-12 |
| Graph RAG | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Done (unique!) |
| All Moroccan levels | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Done (unique!) |
| Vision PDF (geometry) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Done (unique!) |
| Handwriting OCR | ❌ | ❌ | ❌ | ✅ | ❌ | 🔴 BE-11 |
| Global search | ✅ | ✅ | ✅ | ❌ | ❌ | 🔴 FE-12 |
| Dark mode | ✅ | ✅ | ✅ | ✅ | ✅ | 🔴 FE-10 |
