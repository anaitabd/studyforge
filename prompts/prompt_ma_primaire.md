# StudyForge — Moroccan Primaire (1AP → 6AP)

## What's different about primary school
Primary students (ages 6–12) cannot use the standard StudyForge UI. They need:
- Larger text, bigger buttons, simpler words
- Arabic-first with RTL layout
- Read-aloud (text-to-speech via Web Speech API)
- Stars and badges instead of /20 scores
- No complex rubrics — simple right/wrong with encouragement
- Parent/teacher dashboard separate from student view
- CEP (Certificat d'Études Primaires) exam format for 6AP

Read first:
```bash
cat prompts/prompt_fe0_design_system.md
cat apps/api/app/services/curriculum_service.py
cat apps/api/app/services/exam_service.py
```

---

## Step 1 — Curriculum: primary subjects and progression

Add to `apps/api/app/services/curriculum_service.py`:

```python
PRIMAIRE_LEVELS = {
    "1AP": {
        "label": "1ère Année Primaire — السنة الأولى ابتدائي",
        "age_range": "6-7",
        "subjects": ["arabe", "math", "education_islamique", "eps"],
        "notes": "Arabic literacy begins. Numbers 1-100. No French yet.",
    },
    "2AP": {
        "label": "2ème Année Primaire — السنة الثانية ابتدائي",
        "age_range": "7-8",
        "subjects": ["arabe", "french", "math", "education_islamique", "eps"],
        "notes": "French introduced from 2AP.",
    },
    "3AP": {
        "label": "3ème Année Primaire — السنة الثالثة ابتدائي",
        "age_range": "8-9",
        "subjects": ["arabe", "french", "math", "eveil_scientifique", "education_islamique", "eps"],
    },
    "4AP": {
        "label": "4ème Année Primaire — السنة الرابعة ابتدائي",
        "age_range": "9-10",
        "subjects": ["arabe", "french", "math", "eveil_scientifique", "histoire_geo", "education_islamique", "eps"],
    },
    "5AP": {
        "label": "5ème Année Primaire — السنة الخامسة ابتدائي",
        "age_range": "10-11",
        "subjects": ["arabe", "french", "math", "sciences", "histoire_geo", "education_islamique", "eps"],
    },
    "6AP": {
        "label": "6ème Année Primaire — السنة السادسة ابتدائي",
        "age_range": "11-12",
        "subjects": ["arabe", "french", "math", "sciences", "histoire_geo", "education_islamique", "eps"],
        "high_stakes": True,
        "exam": "CEP — Certificat d'Études Primaires",
        "notes": "National exam at end of 6AP. Regional + national.",
    },
}

PRIMAIRE_MATH_TOPICS = {
    "1AP": ["nombres 1-100", "addition", "soustraction", "formes géométriques"],
    "2AP": ["nombres 1-1000", "multiplication intro", "mesures longueur", "monnaie"],
    "3AP": ["multiplication", "division intro", "fractions simples", "périmètre"],
    "4AP": ["fractions", "nombres décimaux", "aire", "angles"],
    "5AP": ["fractions avancées", "proportionnalité", "statistiques simples", "volume intro"],
    "6AP": ["fractions décimaux", "pourcentages", "statistiques", "géométrie", "problèmes complexes"],
}

# CEP exam format (6AP national exam)
CEP_FORMAT = {
    "subjects": ["arabe", "french", "math"],
    "duration_per_subject_minutes": 60,
    "total_points": 20,
    "question_types": ["fill_blank", "mcq_single", "open_calculation", "true_false"],
    "special_notes": "Includes reading comprehension, dictée, and word problems.",
}
```

---

## Step 2 — Child-friendly question generation

Add a `primaire` mode to `exam_service.py`. When level starts with AP:

```python
def _build_primaire_prompt(context, count, subject, level, language="fr"):
    age_map = {"1AP": 6, "2AP": 7, "3AP": 8, "4AP": 9, "5AP": 10, "6AP": 11}
    age = age_map.get(level, 8)
    lang_note = "en arabe" if language == "ar" else "en français simple"

    return (
        f"Génère {count} question(s) pour un élève marocain de {level} ({age} ans), matière: {subject}.\n\n"
        f"RÈGLES ABSOLUES:\n"
        f"- Langage ultra-simple, adapté à un enfant de {age} ans\n"
        f"- Phrases courtes (max 10 mots)\n"
        f"- Contexte familier: famille, école, marché, animaux, maison\n"
        f"- Pas de vocabulaire abstrait\n"
        f"- Questions {lang_note}\n\n"
        f"Types de questions autorisés pour {level}:\n"
        f"- Vrai/Faux (avec phrase simple)\n"
        f"- Compléter avec un mot (un seul mot manquant)\n"
        f"- Choisir la bonne réponse (3 options max, pas 4)\n"
        f"- Calcul simple (résultat attendu en chiffre)\n\n"
        f"Pour chaque question:\n"
        f'- "question": la question\n'
        f'- "correct_answer": la réponse (court)\n'
        f'- "encouragement_correct": phrase d\'encouragement si bon (ex: "Bravo! Tu es fort/forte!")\n'
        f'- "encouragement_wrong": phrase si erreur (ex: "Essaie encore! Tu peux le faire!")\n'
        f'- "difficulty": "facile" | "moyen"\n\n'
        f"CONTENU:\n{context[:2000]}"
    )
```

---

## Step 3 — Child scoring: stars not /20

Add to `grading_service.py`:

```python
def score_to_stars(score: float, total: float) -> int:
    """Convert a raw score to 1-3 stars for child-friendly display."""
    pct = score / total if total > 0 else 0
    if pct >= 0.85:
        return 3
    elif pct >= 0.60:
        return 2
    else:
        return 1

def get_encouragement_message(stars: int, level: str) -> dict:
    """Get age-appropriate encouragement based on stars."""
    lang = "ar" if level in ["1AP", "2AP"] else "fr"
    messages = {
        "fr": {
            3: {"title": "Excellent ! ⭐⭐⭐", "body": "Tu es un(e) champion(ne) ! Continue comme ça !"},
            2: {"title": "Bien joué ! ⭐⭐", "body": "Tu progresses bien. Encore un petit effort !"},
            1: {"title": "Continue ! ⭐", "body": "Tu peux le faire ! Relis la leçon et réessaie."},
        },
        "ar": {
            3: {"title": "ممتاز! ⭐⭐⭐", "body": "أنت بطل/بطلة! هكذا واصل/واصلي!"},
            2: {"title": "جيد! ⭐⭐", "body": "أنت تتقدم جيداً. بذل جهداً أكثر قليلاً!"},
            1: {"title": "حاول مرة أخرى! ⭐", "body": "يمكنك ذلك! أعد قراءة الدرس وحاول مجدداً."},
        },
    }
    return messages[lang][stars]
```

---

## Step 4 — Frontend: child-friendly UI mode

Create `apps/web/components/primaire/PrimaireExamTaker.tsx`:

```tsx
"use client"
// Child-friendly exam UI for 1AP-6AP students
// Larger fonts, simpler layout, star rewards, read-aloud

import { useState } from "react"
import { Volume2, Star, ChevronRight, ChevronLeft } from "lucide-react"

interface PrimaireQuestion {
  id: string
  question: string
  type: "true_false" | "fill_blank" | "mcq_single" | "open_calculation"
  options?: string[]
  correct_answer: string
  encouragement_correct: string
  encouragement_wrong: string
}

export function PrimaireExamTaker({
  questions,
  onComplete,
}: {
  questions: PrimaireQuestion[]
  onComplete: (answers: Record<string, string>) => void
}) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null)

  const q = questions[current]
  const progress = ((current + 1) / questions.length) * 100

  // Text-to-speech
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "fr-MA"
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  const handleAnswer = (answer: string) => {
    const isCorrect = answer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    setAnswers(prev => ({ ...prev, [q.id]: answer }))
    setFeedback({
      correct: isCorrect,
      message: isCorrect ? q.encouragement_correct : q.encouragement_wrong,
    })
  }

  const handleNext = () => {
    setFeedback(null)
    if (current + 1 >= questions.length) {
      onComplete(answers)
    } else {
      setCurrent(c => c + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white p-4">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold text-sky-700">
            Question {current + 1} / {questions.length}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: questions.length }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${
                i < current ? "bg-emerald-500" : i === current ? "bg-sky-500" : "bg-slate-200"
              }`} />
            ))}
          </div>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        {/* Question text — LARGE */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => speak(q.question)}
            className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-sky-200 transition-colors"
          >
            <Volume2 className="w-6 h-6 text-sky-600" />
          </button>
          <p className="text-2xl font-bold text-slate-800 leading-relaxed">{q.question}</p>
        </div>

        {/* Answer options — bigger touch targets */}
        {q.type === "true_false" && (
          <div className="grid grid-cols-2 gap-4">
            {["Vrai ✓", "Faux ✗"].map((opt, i) => {
              const val = i === 0 ? "vrai" : "faux"
              return (
                <button
                  key={val}
                  onClick={() => handleAnswer(val)}
                  className={`py-5 text-xl font-bold rounded-2xl transition-all ${
                    i === 0
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-2 border-emerald-300"
                      : "bg-red-100 text-red-800 hover:bg-red-200 border-2 border-red-300"
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {q.type === "mcq_single" && q.options && (
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(opt)}
                className="w-full py-4 px-5 text-xl font-medium text-left rounded-2xl bg-slate-100 hover:bg-indigo-100 hover:border-indigo-400 border-2 border-slate-200 transition-all text-slate-800"
              >
                <span className="font-bold text-indigo-600 mr-3">
                  {["A", "B", "C"][i]}.
                </span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {(q.type === "fill_blank" || q.type === "open_calculation") && (
          <div className="space-y-4">
            <input
              type={q.type === "open_calculation" ? "number" : "text"}
              placeholder="Ta réponse ici..."
              className="w-full text-2xl font-bold text-center py-4 border-4 border-sky-300 rounded-2xl focus:border-sky-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAnswer((e.target as HTMLInputElement).value)
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = (e.currentTarget.previousSibling as HTMLInputElement)
                handleAnswer(input.value)
              }}
              className="w-full py-4 text-xl font-bold bg-sky-500 text-white rounded-2xl hover:bg-sky-600 transition-colors"
            >
              Vérifier ✓
            </button>
          </div>
        )}
      </div>

      {/* Feedback overlay */}
      {feedback && (
        <div className={`rounded-2xl p-6 mb-4 text-center ${
          feedback.correct ? "bg-emerald-50 border-4 border-emerald-400" : "bg-amber-50 border-4 border-amber-400"
        }`}>
          <div className="text-5xl mb-3">
            {feedback.correct ? "🎉" : "💪"}
          </div>
          <p className="text-2xl font-bold text-slate-800 mb-4">{feedback.message}</p>
          <button
            onClick={handleNext}
            className="bg-indigo-600 text-white py-3 px-8 rounded-2xl text-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            {current + 1 >= questions.length ? "Voir mes résultats →" : "Question suivante →"}
          </button>
        </div>
      )}
    </div>
  )
}
```

Create `apps/web/components/primaire/PrimaireResults.tsx`:

```tsx
function PrimaireResults({ score, total, stars, encouragement, weakAreas }: {
  score: number
  total: number
  stars: 1 | 2 | 3
  encouragement: { title: string; body: string }
  weakAreas: string[]
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-6 text-center">
      {/* Star display */}
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3].map(s => (
          <Star
            key={s}
            className={`w-16 h-16 transition-all ${
              s <= stars ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"
            }`}
          />
        ))}
      </div>

      <h1 className="text-4xl font-bold text-slate-800 mb-2">{encouragement.title}</h1>
      <p className="text-xl text-slate-600 mb-6">{encouragement.body}</p>

      {/* Score */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-6 inline-block">
        <p className="text-5xl font-bold text-indigo-600">{score}<span className="text-2xl text-slate-400">/{total}</span></p>
        <p className="text-slate-500 mt-1">questions correctes</p>
      </div>

      {/* Retry or continue */}
      <div className="space-y-3">
        <button className="w-full py-4 text-xl font-bold bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors">
          Continuer à apprendre 📚
        </button>
        <button className="w-full py-4 text-xl font-medium bg-white border-2 border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 transition-colors">
          Rejouer ce quiz 🔄
        </button>
      </div>
    </div>
  )
}
```

---

## Step 5 — Parent/guardian dashboard

Create `apps/web/app/(app)/parent/page.tsx`:

A simplified dashboard for parents to monitor their child's progress.

```tsx
// Parent sees:
// - Child's streak (days studied)
// - Quiz results per subject (stars, not /20)
// - Which topics need more practice
// - Next recommended activities

function ChildProgressCard({ subject, stars, quizzesCompleted, lastActivity }: {
  subject: string
  stars: number  // average stars out of 3
  quizzesCompleted: number
  lastActivity: string
}) {
  const subjectEmojis: Record<string, string> = {
    arabe: "📖", french: "🇫🇷", math: "🔢",
    sciences: "🔬", histoire_geo: "🗺️", education_islamique: "☪️"
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{subjectEmojis[subject] ?? "📚"}</span>
        <div>
          <p className="font-semibold text-slate-800 capitalize">{subject.replace("_", " ")}</p>
          <p className="text-xs text-slate-500">{quizzesCompleted} quiz · {lastActivity}</p>
        </div>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3].map(s => (
          <Star key={s} className={`w-5 h-5 ${
            s <= Math.round(stars) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"
          }`} />
        ))}
        <span className="text-sm text-slate-500 ml-1">{stars.toFixed(1)}/3</span>
      </div>
    </div>
  )
}
```

---

## Step 6 — RTL support for Arabic content

In `apps/web/app/layout.tsx` or the group page, detect Arabic content and apply `dir="rtl"`:

```tsx
// When subject is Arabic (arabe) or content is Arabic:
const isArabic = subject === "arabe" || /[\u0600-\u06FF]/.test(content)

<div dir={isArabic ? "rtl" : "ltr"} className={isArabic ? "font-arabic text-right" : ""}>
  {content}
</div>
```

Add to `tailwind.config.js` if not present:
```js
// RTL variants are built into Tailwind — use rtl: prefix
// e.g. rtl:text-right, rtl:pl-4 → rtl:pr-4
```

---

## Step 7 — CEP exam format (6AP)

Add to `curriculum_service.py` a CEP question generator that follows the
national exam structure:

```python
CEP_SUBJECTS = {
    "arabe_cep": {
        "parts": [
            {"name": "قراءة وفهم النص", "points": 6, "type": "document_analysis"},
            {"name": "الكتابة الإملائية", "points": 4, "type": "dictee"},
            {"name": "التعبير الكتابي", "points": 10, "type": "essay"},
        ]
    },
    "french_cep": {
        "parts": [
            {"name": "Lecture et compréhension", "points": 8, "type": "document_analysis"},
            {"name": "Expression écrite", "points": 12, "type": "essay"},
        ]
    },
    "math_cep": {
        "parts": [
            {"name": "Calcul", "points": 6, "type": "open_calculation"},
            {"name": "Problèmes", "points": 8, "type": "open_calculation"},
            {"name": "Géométrie", "points": 6, "type": "construction_photo"},
        ]
    },
}
```

---

## Verification

```bash
python -c "
from app.services.curriculum_service import PRIMAIRE_LEVELS, CEP_FORMAT, PRIMAIRE_MATH_TOPICS
print(f'Primaire levels: {list(PRIMAIRE_LEVELS.keys())}')
print(f'6AP exam: {PRIMAIRE_LEVELS[\"6AP\"][\"exam\"]}')
print(f'Math 1AP: {PRIMAIRE_MATH_TOPICS[\"1AP\"]}')
print('OK')
"

cd apps/web && npx tsc --noEmit 2>&1 | head -20
```
