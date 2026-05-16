# StudyForge — BE-13: Performance & Security + FE-7/8/9/10: Frontend Missing Features

---

# BE-13 — Performance & Security

## Read first
```bash
cat apps/api/app/main.py
cat apps/api/app/core/security.py
cat docker-compose.yml
cat apps/api/requirements.txt
```

## Security hardening

### Rate limiting
Add to `apps/api/requirements.txt`: `slowapi`

In `apps/api/app/main.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Apply limits to sensitive endpoints:
```python
# In exams.py
@limiter.limit("10/minute")  # exam generation is expensive
@router.post("/groups/{group_id}/exams/generate")

# In chat.py
@limiter.limit("30/minute")  # per user

# In files.py
@limiter.limit("5/minute")   # upload rate
```

### Input validation — add to all text inputs
```python
import re

def sanitize_text(text: str, max_length: int = 10000) -> str:
    """Strip control characters and limit length."""
    if not text:
        return ""
    # Remove control chars except newline/tab
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    return cleaned[:max_length]
```

Apply `sanitize_text()` to all user-submitted content (chat messages, exam answers, names).

### Security headers — add to main.py
```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["studyforge.ma", "*.studyforge.ma", "localhost"],
)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

## Redis caching strategy

Create `apps/api/app/core/cache.py`:
```python
import json
import functools
from app.core.redis import get_redis

async def cache_get(key: str) -> dict | None:
    redis = await get_redis()
    value = await redis.get(key)
    return json.loads(value) if value else None

async def cache_set(key: str, value: dict, ttl_seconds: int = 300):
    redis = await get_redis()
    await redis.setex(key, ttl_seconds, json.dumps(value))

async def cache_delete(key: str):
    redis = await get_redis()
    await redis.delete(key)
```

Cache these expensive queries (TTL in seconds):
```python
# Group detail (invalidate on group update): 300s
# GET /groups/{id} → cache_key = f"group:{group_id}"

# Org KPI overview (expensive aggregation): 600s  
# GET /org/{slug}/kpis/overview → cache_key = f"org_kpis:{slug}"

# Concept list for a group: 600s
# GET /groups/{id}/concepts → cache_key = f"concepts:{group_id}"

# Leaderboard: 60s
# GET /groups/{id}/leaderboard → cache_key = f"leaderboard:{group_id}"
```

## DB indexes migration

Create a new Alembic migration `add_performance_indexes.py`:

```python
def upgrade():
    # Most-queried foreign keys
    op.create_index("ix_chat_messages_group_id", "chat_messages", ["group_id"])
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
    op.create_index("ix_exam_sessions_user_id", "exam_sessions", ["user_id"])
    op.create_index("ix_exam_sessions_exam_id", "exam_sessions", ["exam_id"])
    op.create_index("ix_flashcard_progress_user_id", "flashcard_progress", ["user_id"])
    op.create_index("ix_flashcard_progress_due_date", "flashcard_progress", ["due_date"])
    op.create_index("ix_user_events_user_id_time", "user_events", ["user_id", "time"])
    op.create_index("ix_user_xp_log_user_id", "user_xp_log", ["user_id"])
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])
    op.create_index("ix_files_group_id_status", "files", ["group_id", "status"])
    op.create_index("ix_knowledge_concepts_file_id", "knowledge_concepts", ["file_id"])
```

---

# FE-7 — Gamification UI

## Read first
```bash
cat apps/web/lib/hooks/use-exams.ts
cat apps/web/app/\(app\)/dashboard/page.tsx
```

## New hook: `apps/web/lib/hooks/use-gamification.ts`
```typescript
export function useMyXP() // GET /me/xp
export function useMyBadges() // GET /me/badges
export function useDailyChallenge() // GET /me/challenge/today
export function useGroupLeaderboard(groupId: string) // GET /groups/:id/leaderboard
export function useUpdateChallengeProgress() // POST /me/challenge/today/progress
```

## XP progress bar (add to every page header)

```tsx
function XPBar({ xp, level, levelTitle, xpToNext }: {
  xp: number; level: number; levelTitle: string; xpToNext: number
}) {
  const pct = Math.min(100, ((xp % xpToNext) / xpToNext) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {level}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-slate-700">{levelTitle}</span>
          <span className="text-slate-500">{xp} XP</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

## Daily challenge widget (add to dashboard)

```tsx
function DailyChallengeWidget({ challenge }: { challenge: DailyChallenge }) {
  const icons: Record<string, string> = {
    review_N_cards: "🃏", complete_exam: "📝", chat_N_messages: "💬",
    study_N_minutes: "⏱️", complete_module: "📚",
  }
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      challenge.completed
        ? "bg-emerald-50 border-emerald-400"
        : "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icons[challenge.type] ?? "⭐"}</span>
          <span className="text-sm font-semibold text-slate-800">Défi du jour</span>
        </div>
        <span className="text-sm font-bold text-indigo-600">+{challenge.xp_reward} XP</span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>{challenge.progress} / {challenge.target}</span>
          <span>{challenge.progress_pct}%</span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${challenge.progress_pct}%` }}
          />
        </div>
      </div>
      {challenge.completed && (
        <div className="text-center text-sm font-bold text-emerald-700">✓ Défi complété !</div>
      )}
    </div>
  )
}
```

## Group leaderboard tab

```tsx
function GroupLeaderboard({ groupId }: { groupId: string }) {
  const { data: lb } = useGroupLeaderboard(groupId)
  const medals = ["🥇", "🥈", "🥉"]
  return (
    <div className="space-y-2">
      {lb?.members.map((member, i) => (
        <div key={member.user_id}
          className={`flex items-center gap-3 p-3 rounded-xl ${
            member.user_id === lb.my_user_id ? "bg-indigo-50 border border-indigo-200" : "bg-white border border-slate-100"
          }`}>
          <span className="text-xl w-8 text-center flex-shrink-0">
            {medals[i] ?? <span className="text-sm font-bold text-slate-500">#{i + 1}</span>}
          </span>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
            {member.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
            <p className="text-xs text-slate-500">{member.level_title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-indigo-600">{member.total_xp.toLocaleString()}</p>
            <p className="text-xs text-slate-400">XP</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

# FE-8 — Live Classroom UI

## Teacher host view: `apps/web/app/(app)/groups/[groupId]/live-quiz/host/page.tsx`

```tsx
"use client"
// Teacher controls: show question, see answers coming in live, reveal results, next question

function LiveQuizHost({ quizId, pin }: { quizId: string; pin: string }) {
  const [state, setState] = useState<LiveQuizState | null>(null)
  const [answerCount, setAnswerCount] = useState(0)

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/v1/live-quiz/${quizId}/stream`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setState(data)
      if (data.event === "answer_submitted") {
        setAnswerCount(c => c + 1)
      }
    }
    return () => es.close()
  }, [quizId])

  return (
    <div className="min-h-screen bg-indigo-900 text-white p-6">
      {/* PIN display — students see this on the projector */}
      <div className="text-center mb-8">
        <p className="text-indigo-300 text-sm uppercase tracking-wide">Code d'accès</p>
        <p className="text-7xl font-bold tracking-widest text-white">{pin}</p>
        <p className="text-indigo-300 text-sm">studyforge.ma/rejoindre</p>
      </div>

      {state?.event === "lobby" && (
        <div className="text-center space-y-4">
          <p className="text-2xl">{state.participant_count ?? 0} élèves connectés</p>
          <button
            onClick={() => startQuiz(quizId)}
            className="bg-emerald-500 text-white px-10 py-4 rounded-2xl text-xl font-bold hover:bg-emerald-400"
          >
            Démarrer ! →
          </button>
        </div>
      )}

      {state?.event?.startsWith("question") && (
        <div className="space-y-6">
          <div className="bg-white/10 rounded-2xl p-6">
            <p className="text-2xl font-bold">{state.question?.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(state.question?.options ?? {}).map(([key, val]) => (
              <div key={key} className="bg-white/10 rounded-xl p-4 text-lg font-medium">
                <span className="font-bold mr-2">{key}.</span>{val as string}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl">{answerCount} réponses reçues</p>
            <button onClick={() => revealResults(quizId)}
              className="bg-amber-400 text-slate-900 px-6 py-3 rounded-xl font-bold">
              Révéler →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

## Student join view: `apps/web/app/(app)/live/[pin]/page.tsx`

```tsx
"use client"
// Student joins with PIN, sees question on their phone, taps their answer

function LiveQuizStudent({ pin }: { pin: string }) {
  const [phase, setPhase] = useState<"join" | "lobby" | "question" | "feedback" | "finished">("join")
  const [question, setQuestion] = useState<any>(null)
  const [answered, setAnswered] = useState(false)
  const [answerStart, setAnswerStart] = useState<number>(0)

  const optionColors = [
    "bg-red-500 hover:bg-red-400",
    "bg-blue-500 hover:bg-blue-400",
    "bg-amber-500 hover:bg-amber-400",
    "bg-emerald-500 hover:bg-emerald-400",
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {phase === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-2xl font-bold">En attente du professeur...</p>
          <p className="text-slate-400 mt-2">Le quiz va bientôt commencer</p>
        </div>
      )}

      {phase === "question" && question && !answered && (
        <div className="flex-1 flex flex-col p-4">
          <div className="bg-white/10 rounded-2xl p-6 mb-6 flex-1 flex items-center justify-center text-center">
            <p className="text-2xl font-bold">{question.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(question.options ?? {}).map(([key, val], i) => (
              <button
                key={key}
                onClick={() => {
                  setAnswered(true)
                  submitAnswer(key, Date.now() - answerStart)
                }}
                className={`${optionColors[i]} text-white py-6 rounded-2xl text-lg font-bold transition-all active:scale-95`}
              >
                {val as string}
              </button>
            ))}
          </div>
        </div>
      )}

      {answered && (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <div className="text-6xl mb-4">✓</div>
            <p className="text-xl font-bold">Réponse envoyée !</p>
            <p className="text-slate-400">En attente des autres élèves...</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

# FE-9 — PWA + Offline Mode

## `apps/web/public/manifest.json`
```json
{
  "name": "StudyForge",
  "short_name": "StudyForge",
  "description": "Plateforme d'apprentissage IA pour les élèves marocains",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "lang": "fr-MA",
  "dir": "ltr",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ],
  "categories": ["education"],
  "screenshots": [
    {"src": "/screenshots/dashboard.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow"}
  ]
}
```

## `apps/web/public/sw.js` — service worker
```javascript
const CACHE = "studyforge-v1"
const OFFLINE_URLS = ["/dashboard", "/groups", "/offline.html"]
const API_CACHE_URLS = ["/api/v1/me/account", "/api/v1/me/kpis"]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS))
  )
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Cache-first for static assets
  if (e.request.destination === "image" || e.request.destination === "font") {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for API — fallback to cached
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request).then(r => r || new Response(
          JSON.stringify({ error: "offline", cached: false }),
          { headers: { "Content-Type": "application/json" } }
        ))
      )
    )
    return
  }

  // HTML pages — network first, fallback to offline page
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request) || caches.match("/offline.html")
    )
  )
})
```

## Register service worker in `apps/web/app/layout.tsx`
```tsx
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(console.error)
  }
}, [])
```

## Mobile bottom navigation

Replace the desktop sidebar with a bottom tab bar when `window.innerWidth < 640`:

```tsx
function MobileNav({ groupId }: { groupId?: string }) {
  const pathname = usePathname()
  const tabs = groupId ? [
    { href: `/groups/${groupId}`, icon: MessageCircle, label: "Chat" },
    { href: `/groups/${groupId}/exams`, icon: FileText, label: "Examens" },
    { href: `/groups/${groupId}/flashcards`, icon: Brain, label: "Cartes" },
    { href: `/groups/${groupId}/slides`, icon: Layout, label: "Slides" },
    { href: `/groups/${groupId}/members`, icon: Users, label: "Groupe" },
  ] : [
    { href: "/dashboard", icon: Home, label: "Accueil" },
    { href: "/groups", icon: BookOpen, label: "Groupes" },
    { href: "/goals", icon: Target, label: "Objectifs" },
    { href: "/account", icon: User, label: "Profil" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe sm:hidden z-50">
      <div className="flex">
        {tabs.map(tab => {
          const active = pathname === tab.href
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-1 transition-colors ${
                active ? "text-indigo-600" : "text-slate-500"
              }`}>
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

---

# FE-10 — Accessibility + Dark Mode + Arabic UI

## Dark mode setup

In `apps/web/tailwind.config.js`:
```js
module.exports = {
  darkMode: "class",  // toggle via class on <html>
  // ...
}
```

In layout, add a dark mode toggle that saves to localStorage and adds `dark` class to `<html>`.

## Arabic UI toggle

Create `apps/web/lib/i18n.ts`:
```typescript
export const UI_STRINGS = {
  fr: {
    dashboard: "Tableau de bord",
    groups: "Mes groupes",
    exams: "Examens",
    flashcards: "Cartes mémoire",
    chat: "Chat IA",
    goals: "Objectifs",
    streak: "Série",
    daily_challenge: "Défi du jour",
  },
  ar: {
    dashboard: "لوحة القيادة",
    groups: "مجموعاتي",
    exams: "الاختبارات",
    flashcards: "البطاقات التعليمية",
    chat: "الدردشة الذكية",
    goals: "الأهداف",
    streak: "التسلسل",
    daily_challenge: "تحدي اليوم",
  },
  en: {
    dashboard: "Dashboard",
    groups: "My groups",
    exams: "Exams",
    flashcards: "Flashcards",
    chat: "AI chat",
    goals: "Goals",
    streak: "Streak",
    daily_challenge: "Daily challenge",
  },
}

export type UILanguage = "fr" | "ar" | "en"
```

Store user's UI language preference in `PATCH /me/account` (add `ui_language` field).
Apply `dir="rtl"` to `<html>` when language is `ar`.

## Accessibility

Add to every interactive component:
```tsx
// Focus ring — add to all buttons, links, inputs
className="... focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"

// Screen reader labels for icon-only buttons
<button aria-label="Lire à voix haute">
  <Volume2 className="w-5 h-5" aria-hidden="true" />
</button>

// Skip to main content link (add to layout)
<a href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-indigo-600 text-white px-4 py-2 rounded-lg z-50">
  Aller au contenu principal
</a>
<main id="main-content">
```

## Verification
```bash
cd apps/web
npx tsc --noEmit 2>&1 | head -20
# Check manifest is valid
cat public/manifest.json | python3 -c "import json,sys; json.load(sys.stdin); print('manifest: OK')"
```
