# StudyForge Frontend — Prompt FE-4: Organization Surface

## Read first
```
cat prompts/prompt_fe0_design_system.md
ls apps/web/app/\(org\)/   (check if this route group exists already)
cat apps/web/lib/hooks/use-org.ts  (if it exists)
cat apps/web/app/\(app\)/layout.tsx
```

Do not write anything until you have read all of the above.

---

## What you are building

A completely separate surface for organizations (schools, companies,
training centers) with three role-specific experiences:
- **Org admin** — oversight, KPIs, user management, cohorts
- **Teacher** — class management, assignments, live monitoring, analytics
- **Student (org)** — assigned tasks, class leaderboard, teacher feedback

This lives under `apps/web/app/(org)/[slug]/` — a separate Next.js
route group with its own layout, completely independent from `(app)`.

---

## Step 1 — Org layout

Create `apps/web/app/(org)/[slug]/layout.tsx`:

```tsx
// This layout:
// 1. Checks Clerk session — redirect to /sign-in if none
// 2. Calls useOrg(slug) — redirect to individual dashboard if user has no membership
// 3. Shows role-aware sidebar
// 4. Shows org branding (logo + name) in sidebar header

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  // Use server-side auth check pattern from existing (app) layout
  // ...
}
```

**Sidebar navigation (role-aware):**
```tsx
const adminNav = [
  { label: 'Dashboard', href: `/org/${slug}`, icon: LayoutDashboard },
  { label: 'Cohorts', href: `/org/${slug}/cohorts`, icon: Users },
  { label: 'Members', href: `/org/${slug}/members`, icon: UserCircle },
  { label: 'At-risk', href: `/org/${slug}/at-risk`, icon: AlertTriangle },
  { label: 'Content library', href: `/org/${slug}/library`, icon: Library },
  { label: 'Settings', href: `/org/${slug}/settings`, icon: Settings },
]

const teacherNav = [
  { label: 'My classes', href: `/org/${slug}/teacher`, icon: Users },
  { label: 'Assignments', href: `/org/${slug}/teacher/assignments`, icon: ClipboardList },
  { label: 'Live', href: `/org/${slug}/teacher/live`, icon: Radio },
]

const studentNav = [
  { label: 'My tasks', href: `/org/${slug}/student/tasks`, icon: ClipboardCheck },
  { label: 'Leaderboard', href: `/org/${slug}/student/leaderboard`, icon: Trophy },
  { label: 'Study', href: `/groups`, icon: BookOpen },
]
```

---

## Step 2 — Org admin dashboard

Create `apps/web/app/(org)/[slug]/page.tsx`:

### KPI overview cards (top row — 5 cards)

```tsx
// Daily active users
<KpiCard label="Daily active" value={kpis.dau} subvalue={`WAU: ${kpis.wau}`} trend="up" icon={<Users />} />

// Avg exam score
<KpiCard
  label="Avg exam score"
  value={kpis.avg_exam_score != null ? `${(kpis.avg_exam_score * 20).toFixed(1)}/20` : '—'}
  icon={<Award />}
  color={kpis.avg_exam_score >= 0.5 ? 'emerald' : 'red'}
/>

// Completion rate
<KpiCard
  label="Path completion"
  value={`${Math.round(kpis.completion_rate * 100)}%`}
  icon={<CheckCircle />}
/>

// At-risk count
<KpiCard
  label="At-risk students"
  value={kpis.at_risk_count}
  icon={<AlertTriangle />}
  color={kpis.at_risk_count > 0 ? 'red' : 'emerald'}
  linkHref={`/org/${slug}/at-risk`}
  alert={kpis.at_risk_count > 0}
/>

// Enrollment rate  
<KpiCard label="Enrolled" value={`${kpis.enrolled}/${kpis.invited}`} icon={<UserCheck />} />
```

### DAU trend chart (Recharts AreaChart, last 30 days)

```tsx
<div className="bg-white rounded-xl border border-slate-200 p-4">
  <h2 className="text-sm font-semibold text-slate-700 mb-4">Daily active users — last 30 days</h2>
  <ResponsiveContainer width="100%" height={160}>
    <AreaChart data={dauTrend}>
      <defs>
        <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip />
      <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#dauGrad)" strokeWidth={2} />
    </AreaChart>
  </ResponsiveContainer>
</div>
```

### Cohort summary table

```tsx
<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-slate-700">Cohorts</h2>
    <Link href={`/org/${slug}/cohorts`} className="text-xs text-indigo-600 hover:underline">View all</Link>
  </div>
  <div className="divide-y divide-slate-100">
    {cohorts.map(cohort => (
      <Link key={cohort.id} href={`/org/${slug}/cohorts/${cohort.id}`}
        className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{cohort.name}</p>
          <p className="text-xs text-slate-500">{cohort.student_count} students</p>
        </div>
        <div className="flex items-center gap-4 ml-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Avg score</p>
            <ScoreOver20 score={cohort.avg_score_over_20} size="sm" />
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Active</p>
            <p className="text-sm font-medium text-slate-700">{cohort.active_rate}%</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </Link>
    ))}
  </div>
</div>
```

### At-risk alert panel (top 5, link to full list)

```tsx
{atRisk.length > 0 && (
  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <AlertTriangle className="w-4 h-4 text-red-600" />
      <h2 className="text-sm font-semibold text-red-800">{atRisk.length} students need attention</h2>
    </div>
    <div className="space-y-2">
      {atRisk.slice(0, 5).map(student => (
        <Link key={student.id} href={`/org/${slug}/students/${student.id}`}
          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
              {student.name[0]}
            </div>
            <span className="text-sm text-slate-700">{student.name}</span>
          </div>
          <span className="text-xs text-red-600 font-medium">
            {student.reason === 'no_activity' ? 'No activity in 7d'
             : student.reason === 'low_score' ? `Score: ${student.last_score}/20`
             : 'At risk'}
          </span>
        </Link>
      ))}
    </div>
    {atRisk.length > 5 && (
      <Link href={`/org/${slug}/at-risk`} className="text-xs text-red-700 font-medium mt-2 block text-right hover:underline">
        View all {atRisk.length} →
      </Link>
    )}
  </div>
)}
```

---

## Step 3 — Cohort detail page

Create `apps/web/app/(org)/[slug]/cohorts/[cohortId]/page.tsx` with 4 tabs:

### Tab: Overview
- KPI cards: avg score /20, completion rate, active rate, at-risk count
- Score distribution: bar chart showing # students at each score range
  (0–9: red, 10–11: amber, 12–13: lime, 14–15: green, 16–20: emerald)

### Tab: Students
Sortable table with columns:
- Name + avatar initial
- Last active (relative time: "2h ago", "3 days ago")
- Avg exam score (with /20 color)
- Learning paths completed / total
- Flashcard retention %
- At-risk badge (red pill if flagged)
- Actions: View profile

```tsx
// At-risk badge
{student.is_at_risk && (
  <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
    <AlertCircle className="w-3 h-3" /> At risk
  </span>
)}
```

Mobile: table collapses to cards showing name, score, last active, and at-risk badge only.

### Tab: Assignments
List of assignments with:
- Title, due date, resource type (exam/path)
- Submission stats: "18/24 submitted" with a progress bar
- Per-assignment: click to see per-student grid

Assignment status grid (teacher view):
```tsx
// 4-column grid: Not started (grey) | In progress (blue) | Submitted (green) | Graded (purple)
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
  {['not_started', 'in_progress', 'submitted', 'graded'].map(status => (
    <div key={status} className={`rounded-lg p-3 text-center ${statusColors[status]}`}>
      <div className="text-xl font-bold">{counts[status]}</div>
      <div className="text-xs capitalize">{status.replace('_', ' ')}</div>
    </div>
  ))}
</div>
```

### Tab: Live (teacher only)
Auto-refreshes every 15s. Shows which students are online now.
```tsx
function LivePanel({ cohortId, slug }: { cohortId: string; slug: string }) {
  const { data: live, isLoading } = useCohortLive(slug, cohortId)
  // Refreshes every 15s via refetchInterval: 15000 in useQuery

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-slate-700">
          {live?.online_count ?? 0} students online now
        </span>
        <span className="text-xs text-slate-400 ml-auto">Refreshes every 15s</span>
      </div>
      <div className="space-y-2">
        {live?.students.map(student => (
          <div key={student.id}
            className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{student.name}</p>
              {student.current_file && (
                <p className="text-xs text-slate-500 truncate">
                  Reading: {student.current_file}
                </p>
              )}
            </div>
            <span className="text-xs text-slate-400">{student.last_active_ago}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Step 4 — Student profile page

Create `apps/web/app/(org)/[slug]/students/[userId]/page.tsx`:

**Header:** name, email, cohort name, account type badge, last active

**Activity timeline:** chronological list from `useStudentTimeline()`:
```tsx
function TimelineEvent({ event }: { event: UserEvent }) {
  const icons = {
    'exam.submitted': FileText,
    'flashcard.reviewed': Brain,
    'file.read': BookOpen,
    'chat.message_sent': MessageCircle,
    'learning_path.module_completed': CheckSquare,
  }
  const Icon = icons[event.event_type] ?? Activity
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="w-px flex-1 bg-slate-200 mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-sm text-slate-700">{eventLabel(event)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {new Date(event.time).toLocaleString('fr-MA')}
        </p>
        {event.metadata?.score_over_20 != null && (
          <ScoreOver20 score={event.metadata.score_over_20} size="sm" />
        )}
      </div>
    </div>
  )
}
```

**Exam history chart:** same LineChart as individual dashboard but for this student.

**Weak areas:** from the AI analysis (shown as chips).

---

## Step 5 — Members management page

Create `apps/web/app/(org)/[slug]/members/page.tsx`:

**Search bar** with 300ms debounce filtering the member list.

**Bulk invite modal:**
```tsx
<textarea
  placeholder="Paste emails, one per line or comma-separated"
  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500"
/>
// Parse pasted text into email list on submit
// Show preview: "3 valid emails found"
// Submit → useBulkInvite()
```

**Member row:**
```tsx
<tr className="hover:bg-slate-50">
  <td className="px-4 py-3">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-medium text-indigo-700">
        {member.name[0]}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{member.name}</p>
        <p className="text-xs text-slate-500">{member.email}</p>
      </div>
    </div>
  </td>
  <td className="px-4 py-3">
    <select
      value={member.role}
      onChange={(e) => updateRole(member.id, e.target.value)}
      className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white"
    >
      <option value="student">Student</option>
      <option value="teacher">Teacher</option>
      <option value="admin">Admin</option>
    </select>
  </td>
  <td className="px-4 py-3 text-xs text-slate-500">{member.last_active_ago ?? 'Never'}</td>
  <td className="px-4 py-3">
    <button onClick={() => confirmRemove(member.id)}
      className="text-red-600 text-xs hover:underline">Remove</button>
  </td>
</tr>
```

---

## Step 6 — Student task view

Create `apps/web/app/(org)/[slug]/student/tasks/page.tsx`:

Group tasks into: Overdue | Due soon (< 3 days) | Upcoming | Completed.

```tsx
function TaskCard({ assignment }: { assignment: Assignment }) {
  const daysLeft = Math.ceil((new Date(assignment.due_at).getTime() - Date.now()) / 86400000)
  const isOverdue = daysLeft < 0
  const isSoon = daysLeft >= 0 && daysLeft < 3
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isOverdue ? 'bg-red-50 border-red-200'
      : isSoon ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              assignment.resource_type === 'exam'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {assignment.resource_type === 'exam' ? 'Exam' : 'Learning path'}
            </span>
            {assignment.progress?.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusChip[assignment.progress.status]}`}>
                {assignment.progress.status.replace('_', ' ')}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{assignment.title}</h3>
          {assignment.instructions && (
            <p className="text-xs text-slate-500 mt-1">{assignment.instructions}</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-xs font-medium ${
          isOverdue ? 'text-red-700' : isSoon ? 'text-amber-700' : 'text-slate-500'
        }`}>
          {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
        </span>
      </div>
      {assignment.progress?.status !== 'submitted' && assignment.progress?.status !== 'graded' && (
        <Link href={`/groups/${assignment.group_id}/${assignment.resource_type}s/${assignment.resource_id}`}
          className="block w-full bg-indigo-600 text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          {assignment.progress?.status === 'in_progress' ? 'Continue' : 'Start'}
        </Link>
      )}
      {assignment.progress?.score_over_20 != null && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Your score</span>
          <ScoreOver20 score={assignment.progress.score_over_20} size="sm" />
        </div>
      )}
    </div>
  )
}
```

---

## Verification

After building all pages and components:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -50
```

Then check every page loads without JS errors:
- `/org/[slug]` — admin dashboard
- `/org/[slug]/cohorts/[id]` — cohort detail with all 4 tabs
- `/org/[slug]/students/[id]` — student profile
- `/org/[slug]/members` — members table
- `/org/[slug]/student/tasks` — student task list

All pages must have `loading.tsx` siblings. All lists must have empty states. Report TypeScript output.
