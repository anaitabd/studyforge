# StudyForge — BE-14: Payments + FE-11: Social + FE-12: Search & Onboarding

---

# BE-14 — Payments & Subscriptions

## Read first
```bash
cat apps/api/app/api/v1/me.py     # existing billing portal
cat apps/api/app/models/user.py
```

## Moroccan pricing plans

```python
# apps/api/app/core/plans.py

PLANS = {
    "free": {
        "name_fr": "Gratuit",
        "name_ar": "مجاني",
        "price_mad": 0,
        "price_eur": 0,
        "limits": {
            "groups": 2,
            "files_per_group": 5,
            "chat_messages_day": 20,
            "exams_month": 5,
            "flashcard_sets": 5,
            "ai_solve_day": 3,       # photo problem solver
            "live_quiz_month": 0,
        },
        "features": ["rag_chat", "flashcards", "exams_basic"],
    },
    "etudiant": {  # Student plan — affordable for Moroccan market
        "name_fr": "Étudiant",
        "name_ar": "طالب",
        "price_mad": 49,    # ~4.5 EUR — accessible for students
        "price_eur": 4.99,
        "stripe_price_id": "price_etudiant_monthly",
        "limits": {
            "groups": 10,
            "files_per_group": 30,
            "chat_messages_day": 200,
            "exams_month": 50,
            "flashcard_sets": 50,
            "ai_solve_day": 20,
            "live_quiz_month": 5,
        },
        "features": ["rag_chat", "flashcards", "exams_all_types", "graph_rag",
                    "gamification", "goals", "live_quiz", "photo_solve"],
    },
    "premium": {
        "name_fr": "Premium",
        "name_ar": "متميز",
        "price_mad": 99,
        "price_eur": 9.99,
        "stripe_price_id": "price_premium_monthly",
        "limits": {
            "groups": 50,
            "files_per_group": 100,
            "chat_messages_day": 1000,
            "exams_month": 200,
            "flashcard_sets": 500,
            "ai_solve_day": 100,
            "live_quiz_month": 50,
        },
        "features": ["all"],
    },
    "ecole": {  # School/org plan — billed per seat
        "name_fr": "École",
        "name_ar": "مدرسة",
        "price_mad_per_seat": 29,
        "min_seats": 10,
        "stripe_price_id": "price_ecole_per_seat",
        "limits": {"all": "unlimited"},
        "features": ["all", "org_dashboard", "teacher_tools", "analytics"],
    },
}
```

## Moroccan payment methods

Morocco's primary online payment gateway is **CMI (Centre Monétique Interbancaire)**.
Also support **CashPlus** (cash payment network) and **Stripe** for international cards.

```python
# apps/api/app/services/payment_service.py

"""
Payment service supporting:
1. Stripe (international cards, Apple Pay, Google Pay)
2. CMI (Moroccan cards — Visa/Mastercard issued by Moroccan banks)
3. CashPlus (cash-in at partner stores — common in Morocco)
"""
import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_checkout_session(
    user_id: str,
    plan: str,
    payment_method: str = "stripe",  # "stripe" | "cmi" | "cashplus"
    success_url: str = "",
    cancel_url: str = "",
) -> dict:
    plan_config = PLANS.get(plan, {})

    if payment_method == "stripe":
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{
                "price": plan_config["stripe_price_id"],
                "quantity": 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id, "plan": plan},
            payment_method_types=["card"],
            locale="fr",
        )
        return {"url": session.url, "session_id": session.id}

    elif payment_method == "cmi":
        # CMI integration — redirect to CMI hosted page
        # CMI uses a redirect-based payment flow similar to PayPal
        # Requires CMI merchant credentials from Moroccan bank
        cmi_payload = {
            "clientid": settings.CMI_CLIENT_ID,
            "amount": str(plan_config["price_mad"]) + ".00",
            "currency": "504",  # MAD ISO 4217 code
            "lang": "fr",
            "callbackUrl": f"{settings.API_BASE_URL}/webhooks/cmi",
            "okUrl": success_url,
            "failUrl": cancel_url,
            "shopurl": settings.FRONTEND_URL,
            "trantype": "PreAuth",
            "storetype": "3d_pay_hosting",
            "hashAlgorithm": "ver3",
            "rnd": str(uuid.uuid4()),
        }
        # Hash is computed as per CMI specification
        return {"url": settings.CMI_PAYMENT_URL, "form_data": cmi_payload}

    elif payment_method == "cashplus":
        # CashPlus — generate a payment code the student takes to a partner store
        # Returns a code + list of nearby stores
        return {
            "payment_code": f"SF-{uuid.uuid4().hex[:8].upper()}",
            "amount_mad": plan_config["price_mad"],
            "expires_hours": 48,
            "instructions": "Présentez ce code dans un point CashPlus partenaire",
            "find_stores_url": "https://www.cashplus.ma/trouver-un-point",
        }


async def handle_stripe_webhook(payload: bytes, signature: str) -> dict:
    """Process Stripe webhooks for subscription lifecycle."""
    event = stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )
    # Handle: checkout.session.completed, customer.subscription.updated,
    #         customer.subscription.deleted, invoice.payment_failed
    return {"received": True, "event_type": event.type}
```

## Payment API endpoints

Add to `apps/api/app/api/v1/me.py`:
```
POST /me/subscribe                — create checkout session
  body: {plan: string, payment_method: "stripe"|"cmi"|"cashplus"}
  returns: {url?, form_data?, payment_code?}

POST /webhooks/stripe             — Stripe webhook (public, no auth)
POST /webhooks/cmi                — CMI webhook (public, no auth)

GET  /me/subscription             — current plan, renewal date, usage
```

---

# FE-11 — Social Features + WhatsApp Sharing

## WhatsApp share button (highest impact for Moroccan market)

```tsx
function WhatsAppShare({ type, data }: {
  type: "exam_result" | "badge" | "streak" | "flashcard_set" | "study_group"
  data: Record<string, any>
}) {
  const messages = {
    exam_result: `🎓 Je viens de passer un examen sur StudyForge !\n📊 Score: ${data.score}/20\n📚 Sujet: ${data.subject}\n\nRejois-moi sur StudyForge → studyforge.ma`,
    badge: `🏆 J'ai débloqué le badge "${data.badge_name}" sur StudyForge !\n${data.badge_icon} ${data.badge_description}\n\nRejois-moi → studyforge.ma`,
    streak: `🔥 ${data.streak_days} jours d'étude consécutifs sur StudyForge !\nOn peut encore faire mieux ensemble → studyforge.ma`,
    flashcard_set: `📚 J'ai créé ${data.card_count} cartes sur "${data.title}" avec l'IA StudyForge !\nRejois-moi → studyforge.ma/groupes/${data.group_id}`,
    study_group: `📖 Rejoins mon groupe d'étude "${data.group_name}" sur StudyForge !\nCode d'invitation: ${data.invite_code}\nstudyforge.ma/rejoindre/${data.invite_code}`,
  }

  const text = messages[type] ?? ""
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#20b859] transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Partager sur WhatsApp
    </a>
  )
}
```

Add this to: exam results page, badge earned modal, streak milestone, and study group invitation.

## Peer challenge

```tsx
function ChallengePeer({ groupId, targetUserId, targetName }: {
  groupId: string; targetUserId: string; targetName: string
}) {
  // Creates a challenge: "Beat [targetName]'s score on this exam"
  return (
    <button
      onClick={() => createChallenge(groupId, targetUserId)}
      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
    >
      <Swords className="w-4 h-4" />
      Défier {targetName}
    </button>
  )
}
```

## Pricing page: `apps/web/app/(app)/pricing/page.tsx`

```tsx
// Shows 3 plans (Gratuit, Étudiant, Premium) + École for institutions
// Highlights:
// - Price in MAD (primary) and EUR (secondary)
// - Payment methods: Carte bancaire (Stripe) · CMI · CashPlus
// - Feature comparison table
// - "Le plus populaire" badge on Étudiant plan
// - Annual discount option (2 months free)

function PaymentMethods() {
  return (
    <div className="flex items-center gap-3 justify-center mt-4">
      <span className="text-xs text-slate-500">Paiement sécurisé via</span>
      <div className="flex items-center gap-2">
        <span className="text-xs bg-slate-100 px-2 py-1 rounded font-medium">💳 Carte</span>
        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">CMI</span>
        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-medium">CashPlus</span>
      </div>
    </div>
  )
}
```

---

# FE-12 — Global Search + Onboarding Flow

## Global search

Create `apps/web/components/shared/GlobalSearch.tsx`:

```tsx
"use client"
// Cmd+K keyboard shortcut opens search
// Searches: groups, files, flashcard sets, learning paths, exams
// Results grouped by type

function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { data: results, isLoading } = useGlobalSearch(query)

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 text-base outline-none placeholder-slate-400"
            placeholder="Rechercher... (groupes, fichiers, examens)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {query.length > 1 && results?.groups?.map(g => (
            <SearchResult key={g.id} type="group" title={g.name} href={`/groups/${g.id}`} />
          ))}
          {query.length > 1 && results?.exams?.map(e => (
            <SearchResult key={e.id} type="exam" title={e.title} href={`/groups/${e.group_id}/exams/${e.id}`} />
          ))}
          {!query && (
            <div className="py-8 text-center text-slate-400 text-sm">
              Tapez pour rechercher dans tout votre contenu
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchResult({ type, title, href }: { type: string; title: string; href: string }) {
  const icons: Record<string, React.ReactNode> = {
    group: <Users className="w-4 h-4 text-indigo-600" />,
    exam: <FileText className="w-4 h-4 text-purple-600" />,
    file: <File className="w-4 h-4 text-amber-600" />,
    flashcard: <Brain className="w-4 h-4 text-emerald-600" />,
  }
  return (
    <Link href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
        {icons[type]}
      </div>
      <span className="text-sm text-slate-700">{title}</span>
      <span className="ml-auto text-xs text-slate-400 capitalize">{type}</span>
    </Link>
  )
}
```

Add backend endpoint `GET /search?q=` that searches across groups, exams, files, flashcard sets.

## Proper onboarding flow

Create `apps/web/app/(app)/onboarding/page.tsx` — 4-step wizard:

**Step 1 — Role:** Je suis... Étudiant / Enseignant / Directeur d'école
**Step 2 — Level:** UniversalLevelSelector (all Moroccan levels)
**Step 3 — Goal:** What do you want to achieve? Préparer le Bac / Réviser pour les examens / Apprendre une nouvelle compétence / Former mes élèves
**Step 4 — First group:** Create your first study group or join one

```tsx
function OnboardingWizard() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({ role: "", level: "", goal: "", system: "" })
  const totalSteps = 4

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
              i < step ? "bg-indigo-600" : "bg-slate-200"
            }`} />
          ))}
        </div>

        {step === 1 && <RoleStep onNext={(role) => { setData(d => ({...d, role})); setStep(2) }} />}
        {step === 2 && <LevelStep onNext={(system, level) => { setData(d => ({...d, system, level})); setStep(3) }} />}
        {step === 3 && <GoalStep onNext={(goal) => { setData(d => ({...d, goal})); setStep(4) }} />}
        {step === 4 && <FirstGroupStep data={data} />}
      </div>
    </div>
  )
}
```

## Verification

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20

# Test manifest
curl http://localhost:3000/manifest.json | python3 -m json.tool > /dev/null && echo "manifest: OK"

# Test service worker registration
echo "Check browser DevTools > Application > Service Workers"
```
