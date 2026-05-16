---
name: StudyForge frontend design system
description: Design tokens, component patterns, and UX rules for the StudyForge Next.js frontend — apply to all frontend work
type: feedback
---

Follow the design system from `prompts/prompt_fe0_design_system.md`. Key rules:

**Score colors (percentage-based, not absolute):**
- ≥80% → `text-emerald-600`
- ≥70% → `text-green-600`
- ≥60% → `text-lime-600`
- ≥50% → `text-amber-600`
- <50%  → `text-red-600`

**ScoreOver20 exact signature:**
```tsx
function ScoreOver20({ score, total = 20, size = 'md' }: {
  score: number | null; total?: number; size?: 'sm' | 'md' | 'lg'
})
```
`null` score renders `<span className="text-slate-400 text-sm">Pending</span>` — NOT "—/20".

**Skeletons:** use `bg-slate-200` (not `bg-slate-100`) + `animate-pulse`.

**Empty states:** always full pattern — icon in `bg-slate-100` circle, heading, description, CTA button.

**Error states:** every query error shows a retry button — never silently empty.

**Buttons:** always include `focus:ring-2 focus:ring-indigo-500` for keyboard accessibility.

**Forbidden:** `any` types, inline styles, alert/confirm, pages without loading.tsx, lists without empty state.

**Why:** established design system — deviations cause visual inconsistency across the app.

**How to apply:** on every frontend file, follow token colors, component signatures, and UX patterns exactly as specified. Do not invent new color classes outside the system.
