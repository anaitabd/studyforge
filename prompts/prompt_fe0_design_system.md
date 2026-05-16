# StudyForge Frontend Design System

## Reference this file at the top of every frontend Claude Code session.

---

## Stack
- Next.js 15 App Router, TypeScript
- Tailwind CSS (utility classes only — no custom CSS files)
- TanStack Query v5 (`useQuery`, `useMutation`, `useQueryClient`)
- Clerk auth (`useAuth`, `useUser`, `currentUser`)
- Recharts for all charts
- Lucide React for all icons
- font-sora as the primary font

## Existing patterns — always follow these

**API calls:** all go through `lib/api.ts` — `apiGet`, `apiPost`, `apiPatch`, `apiDelete`. Clerk JWT is auto-attached. Never use fetch directly.

**Hooks:** one file per domain in `lib/hooks/`. Every hook returns `{ data, isLoading, error }`. Mutations call `queryClient.invalidateQueries()` on success.

**Pages:** every page has a sibling `loading.tsx` with skeletons. No page renders without one.

**Auth guard:** `(app)` layout already checks Clerk session. Org surface uses `(org)/[slug]/` layout.

---

## Design tokens

### Colors
```
Primary:    indigo-600 / indigo-700 (hover)
Success:    emerald-500
Warning:    amber-500  
Error:      red-500
Info:       sky-500
Neutral:    slate-50 (bg) / slate-100 (card) / slate-700 (text) / slate-900 (heading)

Score colors (Moroccan /20 scale):
  >= 16/20:  emerald   (excellent)
  >= 14/20:  green     (good)
  >= 12/20:  lime      (satisfactory)
  >= 10/20:  amber     (passing)
  <  10/20:  red       (failing)

At-risk:    red-50 bg + red-600 text + red-200 border
On-pace:    emerald-50 bg + emerald-600 text
```

### Typography
```
Page title:     text-2xl font-bold text-slate-900
Section title:  text-lg font-semibold text-slate-800
Card title:     text-base font-semibold text-slate-700
Body:           text-sm text-slate-600
Caption:        text-xs text-slate-500
Score large:    text-4xl font-bold (color by score level above)
```

### Cards
```tsx
// Standard card
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">

// Highlighted stat card
<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">

// At-risk
<div className="bg-red-50 rounded-xl border border-red-200 p-4">

// Success
<div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
```

### Buttons
```tsx
// Primary
<button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">

// Secondary
<button className="bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 transition-colors">

// Danger
<button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
```

### Skeletons (every loading.tsx must use these)
```tsx
// Line
<div className="h-4 bg-slate-200 rounded animate-pulse" />

// Card
<div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
  <div className="h-5 w-1/3 bg-slate-200 rounded animate-pulse" />
  <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
  <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
</div>
```

### Empty states (every list must have one)
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
    <IconName className="w-8 h-8 text-slate-400" />
  </div>
  <h3 className="text-base font-semibold text-slate-700 mb-1">No [items] yet</h3>
  <p className="text-sm text-slate-500 mb-4 max-w-xs">[Helpful description]</p>
  <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
    [Primary CTA]
  </button>
</div>
```

---

## Score display component (reuse everywhere)
```tsx
function ScoreOver20({ score, total = 20, size = 'md' }: {
  score: number | null
  total?: number
  size?: 'sm' | 'md' | 'lg'
}) {
  if (score === null) return <span className="text-slate-400 text-sm">Pending</span>
  const pct = score / total
  const color = pct >= 0.8 ? 'text-emerald-600'
    : pct >= 0.7 ? 'text-green-600'
    : pct >= 0.6 ? 'text-lime-600'
    : pct >= 0.5 ? 'text-amber-600'
    : 'text-red-600'
  const sizes = { sm: 'text-lg font-bold', md: 'text-2xl font-bold', lg: 'text-4xl font-bold' }
  return (
    <span className={`${sizes[size]} ${color}`}>
      {score.toFixed(1)}
      <span className="text-slate-400 font-normal text-sm">/{total}</span>
    </span>
  )
}
```

---

## UX rules — never break these

1. Mobile first — every component works at 375px. Tables become stacked cards on mobile.
2. Loading states — every data-dependent render shows a skeleton.
3. Empty states — every list has a meaningful empty state with a CTA.
4. Error states — every query error shows a retry button.
5. Optimistic updates — toggles update instantly, revert on failure.
6. No layout shift — reserve space before content loads.
7. RTL support — use `rtl:` variants for Arabic text (`dir="rtl"`).
8. Keyboard accessible — all interactive elements have `focus:ring-2 focus:ring-indigo-500`.
9. Score colors — always use the /20 color scale for any score display.
10. Destructive confirmations — 2-step confirm modal, never `confirm()`.

## Forbidden patterns
- No useState for server data — use TanStack Query
- No useEffect for data fetching — use useQuery
- No `any` TypeScript — define proper interfaces
- No inline styles — use Tailwind
- No alert/confirm/prompt — use modals
- No hardcoded colors outside token system
- No page without loading.tsx
- No list without empty state
