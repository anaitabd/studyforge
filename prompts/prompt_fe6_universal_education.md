# StudyForge Frontend — FE-6: Universal Education UI

## Read first
```
cat prompts/prompt_fe0_design_system.md
cat apps/web/app/\(app\)/onboarding/page.tsx
cat apps/web/app/\(app\)/groups/\[groupId\]/exams/\[examId\]/page.tsx
```

---

## Part 1 — Universal onboarding level selector

Replace the Moroccan-only level picker with a universal one.
Fetch `GET /api/v1/me/education-systems` (or use hardcoded data from
the backend `get_all_systems()` response).

```tsx
"use client"
import { useState } from "react"

const EDUCATION_SYSTEMS = [
  {
    system: "MA",
    name: "Maroc 🇲🇦",
    flag: "🇲🇦",
    cycles: [
      { label: "Collège", levels: [
        { code: "1AC", label: "1ère Année Collège" },
        { code: "2AC", label: "2ème Année Collège" },
        { code: "3AC", label: "3ème Année (Brevet)" },
      ]},
      { label: "Lycée — TC", levels: [
        { code: "TC_S", label: "TC Sciences" },
        { code: "TC_L", label: "TC Lettres" },
      ]},
      { label: "1ère Bac", levels: [
        { code: "1BAC_SE", label: "Sc. Expérimentales" },
        { code: "1BAC_SM", label: "Sc. Math" },
        { code: "1BAC_SEG", label: "SEG" },
        { code: "1BAC_L", label: "Lettres" },
      ]},
      { label: "2ème Bac", levels: [
        { code: "2BAC_SE", label: "Sc. Expérimentales" },
        { code: "2BAC_SM_A", label: "Sc. Math A" },
        { code: "2BAC_SM_B", label: "Sc. Math B" },
        { code: "2BAC_SEG", label: "SEG" },
        { code: "2BAC_SH", label: "Sc. Humaines" },
        { code: "2BAC_L", label: "Lettres" },
      ]},
    ],
  },
  {
    system: "FR",
    name: "France 🇫🇷",
    flag: "🇫🇷",
    cycles: [
      { label: "Collège", levels: [
        { code: "6e", label: "6ème" }, { code: "5e", label: "5ème" },
        { code: "4e", label: "4ème" }, { code: "3e", label: "3ème (Brevet)" },
      ]},
      { label: "Lycée", levels: [
        { code: "2nde", label: "Seconde" },
        { code: "1ere_G", label: "Première Générale" },
        { code: "Tle_G", label: "Terminale (Bac)" },
      ]},
    ],
  },
  {
    system: "UNIV",
    name: "Université 🎓",
    flag: "🎓",
    cycles: [
      { label: "Licence", levels: [
        { code: "L1", label: "L1 (Bac+1)" },
        { code: "L2", label: "L2 (Bac+2)" },
        { code: "L3", label: "L3 (Bac+3)" },
      ]},
      { label: "Master", levels: [
        { code: "M1", label: "M1 (Bac+4)" },
        { code: "M2", label: "M2 (Bac+5)" },
      ]},
      { label: "Autres", levels: [
        { code: "BTS", label: "BTS" },
        { code: "CPGE", label: "CPGE (Prépa)" },
        { code: "PHD", label: "Doctorat" },
      ]},
    ],
  },
  {
    system: "CERT",
    name: "Certifications 📜",
    flag: "📜",
    cycles: [
      { label: "Cloud", levels: [
        { code: "AWS_CP", label: "AWS Cloud Practitioner" },
        { code: "AWS_SAA", label: "AWS Solutions Architect" },
        { code: "AZURE_900", label: "Azure Fundamentals" },
      ]},
      { label: "Management", levels: [
        { code: "PMP", label: "PMP" },
        { code: "SCRUM", label: "Scrum Master" },
      ]},
      { label: "Finance", levels: [
        { code: "CFA_1", label: "CFA Level 1" },
        { code: "CFA_2", label: "CFA Level 2" },
      ]},
      { label: "Language", levels: [
        { code: "IELTS", label: "IELTS" },
        { code: "TOEFL", label: "TOEFL" },
        { code: "DELF_B2", label: "DELF B2" },
      ]},
    ],
  },
]

function UniversalLevelSelector({ value, onChange }: {
  value: string | null
  onChange: (system: string, level: string) => void
}) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* System tabs */}
      <div className="flex flex-wrap gap-2">
        {EDUCATION_SYSTEMS.map((sys) => (
          <button
            key={sys.system}
            onClick={() => setSelectedSystem(sys.system)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedSystem === sys.system
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:border-indigo-300"
            }`}
          >
            {sys.flag} {sys.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Level picker for selected system */}
      {selectedSystem && (() => {
        const sys = EDUCATION_SYSTEMS.find(s => s.system === selectedSystem)!
        return (
          <div className="space-y-4 bg-slate-50 rounded-xl p-4">
            {sys.cycles.map((cycle) => (
              <div key={cycle.label}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  {cycle.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cycle.levels.map((level) => (
                    <button
                      key={level.code}
                      onClick={() => onChange(selectedSystem, level.code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        value === level.code
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
```

---

## Part 2 — Code exercise question type in exam taker

Add to `QuestionRenderer.tsx` (from FE-2):

```tsx
function CodeExerciseInput({ question, value, onChange }: {
  question: {
    instruction: string
    starter_code: string
    hints: string[]
    concepts_tested: string[]
  }
  value: { code: string }
  onChange: (v: { code: string }) => void
}) {
  const [showHints, setShowHints] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)

  return (
    <div className="space-y-3">
      {/* Concept chips */}
      {question.concepts_tested?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {question.concepts_tested.map((c, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Code editor — monospace textarea */}
      <div className="relative">
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-mono text-slate-800 bg-slate-950 min-h-[200px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed"
          placeholder={question.starter_code || "# Write your code here..."}
          value={value.code}
          onChange={(e) => onChange({ code: e.target.value })}
          spellCheck={false}
        />
        <div className="absolute top-2 right-2 text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
          Python
        </div>
      </div>

      {/* Hints system */}
      {question.hints?.length > 0 && (
        <div>
          <button
            onClick={() => { setShowHints(true); setHintIndex(Math.min(hintIndex + 1, question.hints.length - 1)) }}
            className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium"
          >
            💡 {showHints ? `Hint ${hintIndex + 1}/${question.hints.length}` : "Show hint"}
          </button>
          {showHints && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              {question.hints[hintIndex]}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## Part 3 — Certification exam mode

When `exam.level` is a certification (AWS_*, PMP, CFA_*, IELTS, etc.),
show a certification-specific exam header:

```tsx
function CertificationExamBanner({ level, certInfo }: {
  level: string
  certInfo: { questions: number; duration_minutes: number; passing_score: number | null }
}) {
  const certLabels: Record<string, string> = {
    AWS_CP: "AWS Cloud Practitioner",
    AWS_SAA: "AWS Solutions Architect Associate",
    PMP: "Project Management Professional",
    CFA_1: "CFA Level 1",
    IELTS: "IELTS Academic",
  }
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-indigo-200 font-medium uppercase tracking-wide">Practice Exam</p>
          <h2 className="text-lg font-bold">{certLabels[level] ?? level}</h2>
        </div>
        <div className="text-right space-y-1">
          {certInfo.questions && (
            <p className="text-sm text-indigo-200">
              <span className="text-white font-bold">{certInfo.questions}</span> questions
            </p>
          )}
          {certInfo.duration_minutes && (
            <p className="text-sm text-indigo-200">
              <span className="text-white font-bold">
                {Math.floor(certInfo.duration_minutes / 60)}h{certInfo.duration_minutes % 60 > 0 ? `${certInfo.duration_minutes % 60}m` : ""}
              </span> duration
            </p>
          )}
          {certInfo.passing_score && (
            <p className="text-sm text-indigo-200">
              Pass: <span className="text-white font-bold">{certInfo.passing_score}%</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Part 4 — IELTS writing task UI

IELTS Task 2 is an essay with specific constraints. Add this as a
specialized essay input:

```tsx
function IELTSWritingInput({ taskType, prompt, value, onChange }: {
  taskType: 1 | 2
  prompt: string
  value: { text: string }
  onChange: (v: { text: string }) => void
}) {
  const wordCount = value.text.trim().split(/\s+/).filter(Boolean).length
  const minWords = taskType === 1 ? 150 : 250
  const isUnderMin = wordCount < minWords

  return (
    <div className="space-y-3">
      {/* Task header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">
            WRITING TASK {taskType}
          </span>
          <span className="text-xs text-amber-700">Minimum {minWords} words</span>
        </div>
        <p className="text-sm text-amber-900 font-medium">{prompt}</p>
      </div>

      {/* Writing area */}
      <textarea
        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700 min-h-[300px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed"
        placeholder="Write your response here..."
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />

      {/* Word count */}
      <div className={`flex items-center justify-between text-xs font-medium ${
        isUnderMin ? "text-red-600" : "text-emerald-600"
      }`}>
        <span>
          {wordCount} / {minWords} words minimum
          {isUnderMin && ` — ${minWords - wordCount} more needed`}
        </span>
        {!isUnderMin && <span>✓ Word count met</span>}
      </div>

      {/* Band score guide */}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">
          IELTS band score criteria
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            ["Task Achievement", "Address all parts. Clear position."],
            ["Coherence & Cohesion", "Logical structure. Paragraphing."],
            ["Lexical Resource", "Wide vocabulary. Precise word choice."],
            ["Grammar Range", "Varied structures. Accurate."],
          ].map(([cat, desc]) => (
            <div key={cat} className="bg-slate-50 rounded-lg p-2">
              <p className="font-medium text-slate-600">{cat}</p>
              <p className="text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
```

---

## Part 5 — Group creation with education context

Update the create group modal in `apps/web/app/(app)/groups/page.tsx`:

```tsx
// Add to CreateGroupModal:
<div className="space-y-2">
  <label className="text-sm font-medium text-slate-700">
    Education level (optional)
  </label>
  <p className="text-xs text-slate-500">
    Helps the AI generate better exam questions for your level.
  </p>
  <UniversalLevelSelector
    value={form.level}
    onChange={(system, level) => setForm(f => ({ ...f, education_system: system, level }))}
  />
</div>
```

Store `education_system` and `level` on the group. Add these columns to the
`groups` table: `education_system VARCHAR(10)`, `level VARCHAR(20)`.
Create Alembic migration.

---

## Part 6 — Dashboard: smart content recommendations

Based on the user's level and education system, show relevant content:

```tsx
function SmartRecommendations({ level, system }: { level: string; system: string }) {
  const recommendations = {
    "2BAC_SEG": [
      "Upload your DS and DC documents — the AI will extract exercises and generate similar ones",
      "Generate probability flashcards from your textbook chapters",
      "Create a learning path for your Bac revision: Probabilités → Variables aléatoires → Statistiques",
    ],
    "AWS_SAA": [
      "Upload the AWS Well-Architected whitepaper for RAG-based Q&A",
      "Generate scenario-based practice questions from each domain",
      "Use flashcards for AWS service limits and key differences",
    ],
    "M2": [
      "Upload your research papers — generate critical analysis questions",
      "Create flashcards for key theories and authors",
      "Generate oral defense questions from your thesis outline",
    ],
  }

  const tips = recommendations[level] ?? [
    "Upload your course materials to start generating study content",
    "Use the AI chat to ask questions about anything in your documents",
    "Generate flashcards for key terms and concepts",
  ]

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-3">
        Recommended for {level}
      </p>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
            <span className="text-indigo-400 mt-0.5">→</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## Verification

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Check that all new components render without errors on:
- Moroccan 2BAC exam flow
- AWS certification practice exam
- IELTS writing task
- University case study question
- Code exercise with hints

Report TypeScript output.
