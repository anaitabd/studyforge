# StudyForge Frontend — Prompt FE-3: Individual Learner Dashboard

## Read first
```
cat prompts/prompt_fe0_design_system.md
cat apps/web/app/\(app\)/dashboard/page.tsx
cat apps/web/lib/hooks/use-continue-learning.ts
cat apps/web/lib/hooks/use-individual-kpis.ts  (may not exist yet)
```

---

## What you are building

A personal performance dashboard that shows a learner exactly where they
stand: streak, daily activity, flashcard health, exam trend, goals, and
AI-identified weak areas. This replaces or extends the current plain
group-list dashboard.

---

## Part 1 — Dashboard layout

Replace the existing dashboard `page.tsx` with a two-column layout on
desktop, single column on mobile:

```
┌─────────────────────┬──────────────────────┐
│  Streak + KPI row   │  Continue Learning   │
├─────────────────────┤  (existing widget)   │
│  Goal progress      │                      │
├─────────────────────┤──────────────────────┤
│  Exam score trend   │  Weak areas          │
├─────────────────────┴──────────────────────┤
│  Groups (existing cards)                   │
└────────────────────────────────────────────┘
```

On mobile: full-width stack, same order.

---

## Part 2 — Streak widget

Place in the top-left, always visible even when other KPIs are loading.

```tsx
function StreakWidget({ streak }: {
  streak: { current: number; longest: number; today_active: boolean } | undefined
}) {
  if (!streak) return <StreakSkeleton />
  const flames = Math.min(streak.current, 7)
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className="relative">
        <div className="text-4xl">🔥</div>
        {streak.today_active && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{streak.current} days</div>
        <div className="text-xs text-slate-500">
          {streak.today_active ? '✓ Studied today' : 'Study today to keep your streak!'}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          Longest: {streak.longest} days
        </div>
      </div>
      {/* Mini flame dots for last 7 days */}
      <div className="ml-auto flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-6 rounded-full ${i < flames ? 'bg-orange-400' : 'bg-slate-100'}`}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Part 3 — KPI stat cards row

4 cards in a responsive grid (2x2 on mobile, 4x1 on desktop):

```tsx
// Active minutes today
<StatCard
  label="Active today"
  value={`${kpis.active_minutes_today}m`}
  target={`/ ${kpis.active_minutes_goal}m goal`}
  progress={kpis.active_minutes_today / kpis.active_minutes_goal}
  icon={<Clock />}
  color="indigo"
/>

// Flashcard retention rate
<StatCard
  label="Retention rate"
  value={`${Math.round(kpis.flashcard_retention_rate * 100)}%`}
  sublabel={`${kpis.cards_due_today} cards due`}
  icon={<Brain />}
  color={kpis.flashcard_retention_rate >= 0.7 ? 'emerald' : 'amber'}
  alert={kpis.cards_overdue > 0 ? `${kpis.cards_overdue} overdue` : undefined}
/>

// Latest exam score
<StatCard
  label="Last exam"
  value={kpis.exam_score_trend?.at(-1)?.score != null
    ? `${(kpis.exam_score_trend.at(-1).score * 20).toFixed(1)}/20`
    : '—'}
  icon={<FileText />}
  color={/* use score color scale */}
/>

// Study goal progress
<StatCard
  label="Goal"
  value={kpis.study_goal?.title ?? 'No goal set'}
  sublabel={kpis.study_goal ? (kpis.study_goal.on_pace ? '✓ On pace' : '⚠ Behind pace') : 'Set a goal'}
  icon={<Target />}
  color={kpis.study_goal?.on_pace ? 'emerald' : 'amber'}
  linkHref="/goals"
/>
```

The `StatCard` component:
```tsx
function StatCard({ label, value, sublabel, target, progress, icon, color, alert, linkHref }: {
  label: string
  value: string
  sublabel?: string
  target?: string
  progress?: number  // 0–1 for progress bar
  icon: React.ReactNode
  color: 'indigo' | 'emerald' | 'amber' | 'red'
  alert?: string
  linkHref?: string
}) {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
    red: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
  }
  const c = colorMap[color]
  const inner = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center`}>
          <div className={`w-4 h-4 ${c.text}`}>{icon}</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {target && <div className="text-xs text-slate-500">{target}</div>}
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all`}
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      )}
      {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
      {alert && (
        <div className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
          ⚠ {alert}
        </div>
      )}
    </div>
  )
  return linkHref ? <Link href={linkHref}>{inner}</Link> : inner
}
```

---

## Part 4 — Exam score trend chart

```tsx
function ExamTrendChart({ trend }: {
  trend: Array<{ date: string; score: number }> | undefined
}) {
  if (!trend?.length) return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Exam score trend</h3>
      {/* empty state */}
      <div className="flex flex-col items-center py-8 text-center">
        <BarChart2 className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Complete an exam to see your trend</p>
      </div>
    </div>
  )

  const data = trend.map(t => ({
    date: new Date(t.date).toLocaleDateString('fr-MA', { month: 'short', day: 'numeric' }),
    score: parseFloat((t.score * 20).toFixed(1)),
  }))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Exam score trend</h3>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
          <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Pass', fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Tooltip formatter={(v: number) => [`${v}/20`, 'Score']} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

## Part 5 — Weak areas widget

```tsx
function WeakAreasWidget({ weakAreas }: { weakAreas: string[] | undefined }) {
  if (!weakAreas) return <WeakAreasSkeleton />
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Areas to review</h3>
        <span className="text-xs text-slate-400">Identified by AI</span>
      </div>
      {weakAreas.length === 0 ? (
        <p className="text-sm text-emerald-600 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" /> No weak areas detected — great work!
        </p>
      ) : (
        <ul className="space-y-2">
          {weakAreas.map((area, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm text-slate-600">{area}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

---

## Part 6 — Goals page

Create `apps/web/app/(app)/goals/page.tsx`:

**Goal creation form:**
- Title (text input)
- Subject (select: Maths, Français, Arabe, Sciences, Physique, Histoire-Géo)
- Target date (date picker — native `<input type="date">`)
- Target score / 20 (number input, 0–20)
- File selector (multi-select from user's groups' ready files)

**Goal card:**
```tsx
function GoalCard({ goal }: { goal: StudyGoal }) {
  const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000)
  const progressPct = /* compute from activity vs expected */ 0
  return (
    <div className={`rounded-xl border p-4 ${
      goal.status === 'achieved' ? 'bg-emerald-50 border-emerald-200'
      : daysLeft < 7 ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{goal.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Target: {goal.target_score}/20 · {goal.subject}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          daysLeft < 0 ? 'bg-red-100 text-red-700'
          : daysLeft < 7 ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600'
        }`}>
          {daysLeft < 0 ? 'Overdue' : `${daysLeft}d left`}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Progress</span><span>{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

---

## Part 7 — Flashcard due badge

On the existing flashcard sets list page, add a due-today badge:

```tsx
// In flashcard set card
{set.due_count > 0 && (
  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
    {set.due_count} due
  </span>
)}
```

This requires extending the `useFlashcardSets` hook to include
`due_count` from the existing `GET /groups/:id/flashcard-sets` endpoint
(or calling `GET /groups/:id/flashcard-sets/:id/due` to get count).

---

## Verification

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

All TypeScript errors resolved. Report the output.
