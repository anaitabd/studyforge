# StudyForge Frontend — FE-5: Math Rendering + Exam Document Viewer

## Read first
```
cat prompts/prompt_fe0_design_system.md
find apps/web/app -name "page.tsx" | grep -i exam | sort
cat apps/web/lib/hooks/use-exams.ts
cat apps/web/package.json
```

---

## Step 1 — Install KaTeX for math rendering

```bash
cd apps/web
npm install katex react-katex
npm install --save-dev @types/katex
```

Create `apps/web/components/shared/MathRenderer.tsx`:

```tsx
"use client"
import "katex/dist/katex.min.css"
import { InlineMath, BlockMath } from "react-katex"

interface MathRendererProps {
  text: string           // may contain $...$ or $$...$$
  className?: string
}

/**
 * Renders text that may contain LaTeX math notation.
 * - Inline: $P(A) = \frac{6}{56}$
 * - Block:  $$P(A \cap B) = P(A) \times P(B)$$
 * - Plain text is rendered as-is.
 */
export function MathRenderer({ text, className }: MathRendererProps) {
  if (!text) return null

  // Split on $$...$$ (block) then $...$ (inline)
  const parts = splitMath(text)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "block") {
          return (
            <div key={i} className="my-2">
              <BlockMath math={part.content} />
            </div>
          )
        }
        if (part.type === "inline") {
          return <InlineMath key={i} math={part.content} />
        }
        return <span key={i}>{part.content}</span>
      })}
    </span>
  )
}

type MathPart = { type: "text" | "inline" | "block"; content: string }

function splitMath(text: string): MathPart[] {
  const parts: MathPart[] = []
  // Match $$...$$ and $...$ patterns
  const regex = /\$\$([\s\S]*?)\$\$|\$((?:[^$\\]|\\.)*)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      parts.push({ type: "block", content: match[1] })
    } else if (match[2] !== undefined) {
      parts.push({ type: "inline", content: match[2] })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) })
  }

  return parts
}
```

Use `<MathRenderer text={question.content} />` everywhere a question or
explanation is displayed. Replace every plain `<p>{question.content}</p>`
with `<MathRenderer text={question.content} />`.

---

## Step 2 — Probability table renderer

Many Moroccan math questions include probability distribution tables.
Create `apps/web/components/shared/ProbabilityTable.tsx`:

```tsx
interface ProbabilityTableProps {
  variable: string        // e.g. "X"
  values: (number | string)[]   // e.g. [0, 1, 2]
  probabilities: (string | number | null)[]  // e.g. ["15/36", null, null]
  editable?: boolean      // allow student to fill in empty cells
  onFill?: (index: number, value: string) => void
}

export function ProbabilityTable({
  variable,
  values,
  probabilities,
  editable = false,
  onFill,
}: ProbabilityTableProps) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="border-collapse border border-slate-400 text-sm">
        <tbody>
          <tr>
            <td className="border border-slate-400 px-4 py-2 bg-slate-50 font-medium text-slate-700">
              <InlineMath math={variable_i} />
            </td>
            {values.map((v, i) => (
              <td key={i} className="border border-slate-400 px-4 py-2 text-center font-medium text-slate-800">
                {typeof v === "number" ? v : v}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-slate-400 px-4 py-2 bg-slate-50 font-medium text-slate-700">
              <InlineMath math={`P(${variable} = ${variable}_i)`} />
            </td>
            {probabilities.map((p, i) => (
              <td key={i} className="border border-slate-400 px-4 py-2 text-center min-w-[80px]">
                {p !== null ? (
                  typeof p === "string" && p.includes("/") ? (
                    <InlineMath math={`\\frac{${p.split("/")[0]}}{${p.split("/")[1]}}`} />
                  ) : (
                    <span>{p}</span>
                  )
                ) : editable ? (
                  <input
                    type="text"
                    placeholder="?"
                    className="w-16 text-center border border-indigo-300 rounded px-1 py-0.5 text-sm focus:ring-1 focus:ring-indigo-500"
                    onChange={(e) => onFill?.(i, e.target.value)}
                  />
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

---

## Step 3 — Moroccan exam document viewer

When a file has `exam_metadata` (detected as a DS/DC/BAC), show a
structured exam viewer instead of just raw text.

Create `apps/web/components/files/ExamDocumentViewer.tsx`:

```tsx
"use client"
import { MathRenderer } from "@/components/shared/MathRenderer"
import { BookOpen, Clock, Award, User, School } from "lucide-react"

interface ExamHeader {
  prof: string | null
  lycee: string | null
  classe: string | null
  exam_type: string | null
  exam_number: number | null
  subject: string | null
  duration_minutes: number | null
  total_points: number
}

interface SubQuestion {
  label: string
  text: string
  points: number | null
  has_formula: boolean
  expected_answer_type: string
}

interface Exercise {
  number: number
  title: string | null
  points: number
  context: string
  sub_questions: SubQuestion[]
}

interface ExamDocumentViewerProps {
  header: ExamHeader
  exercises: Exercise[]
  onPractice?: (exerciseIndex: number) => void
  onGenerateSimilar?: (exerciseIndex: number) => void
}

export function ExamDocumentViewer({
  header,
  exercises,
  onPractice,
  onGenerateSimilar,
}: ExamDocumentViewerProps) {
  const examTypeLabel = {
    DS: "Devoir Surveillé",
    DC: "Devoir de Contrôle",
    DM: "Devoir Maison",
    BAC: "Baccalauréat",
  }[header.exam_type ?? ""] ?? header.exam_type

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sora">
      {/* Exam header — mimics the physical exam paper */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-3 border-b border-slate-200">
          {/* Left: Prof + Lycée */}
          <div className="p-4 border-r border-slate-200 space-y-1">
            {header.prof && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <User className="w-3 h-3" /> {header.prof}
              </div>
            )}
            {header.lycee && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <School className="w-3 h-3" /> {header.lycee}
              </div>
            )}
          </div>
          {/* Center: Exam title */}
          <div className="p-4 flex items-center justify-center border-r border-slate-200">
            <div className="text-center">
              <p className="text-base font-bold text-slate-900">{examTypeLabel}</p>
              {header.exam_number && (
                <p className="text-sm text-slate-600">N°{header.exam_number}</p>
              )}
            </div>
          </div>
          {/* Right: Classe + Durée */}
          <div className="p-4 space-y-1">
            {header.classe && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <BookOpen className="w-3 h-3" /> {header.classe}
              </div>
            )}
            {header.duration_minutes && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="w-3 h-3" />
                {header.duration_minutes >= 60
                  ? `${Math.floor(header.duration_minutes / 60)}h${header.duration_minutes % 60 > 0 ? header.duration_minutes % 60 + "min" : ""}`
                  : `${header.duration_minutes}min`}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Award className="w-3 h-3" /> {header.total_points} points
            </div>
          </div>
        </div>
        {/* Motivational line */}
        <div className="bg-slate-50 px-4 py-2 text-center text-xs text-slate-500 italic">
          Bonne chance ! 🍀
        </div>
      </div>

      {/* Exercises */}
      {exercises.map((exercise, ei) => (
        <div key={ei} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Exercise header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 underline">
                EXERCICE {exercise.number}
              </span>
              <span className="text-sm text-slate-600">({exercise.points} points)</span>
              {exercise.title && (
                <span className="text-sm text-slate-500">— {exercise.title}</span>
              )}
            </div>
            {/* Action buttons for teachers/students */}
            <div className="flex items-center gap-2">
              {onPractice && (
                <button
                  onClick={() => onPractice(ei)}
                  className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  Practice this
                </button>
              )}
              {onGenerateSimilar && (
                <button
                  onClick={() => onGenerateSimilar(ei)}
                  className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                >
                  Generate similar
                </button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Problem context */}
            <div className="text-sm text-slate-700 leading-relaxed">
              <MathRenderer text={exercise.context} />
            </div>

            {/* Sub-questions */}
            <div className="space-y-3 ml-2">
              {exercise.sub_questions.map((sq, sqi) => (
                <div key={sqi} className="flex gap-3">
                  <span className="font-semibold text-slate-700 flex-shrink-0 min-w-[32px]">
                    {sq.label}
                  </span>
                  <div className="flex-1">
                    <MathRenderer text={sq.text} className="text-sm text-slate-700" />
                    {sq.points && (
                      <span className="text-xs text-slate-400 ml-2">({sq.points} pts)</span>
                    )}
                    {/* Answer type badge */}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${answerTypeBadge[sq.expected_answer_type] ?? 'bg-slate-100 text-slate-500'}`}>
                      {answerTypeLabel[sq.expected_answer_type] ?? sq.expected_answer_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const answerTypeBadge: Record<string, string> = {
  proof: "bg-purple-100 text-purple-700",
  calculation: "bg-blue-100 text-blue-700",
  fill_blank: "bg-amber-100 text-amber-700",
  boolean: "bg-orange-100 text-orange-700",
  essay: "bg-emerald-100 text-emerald-700",
}

const answerTypeLabel: Record<string, string> = {
  proof: "Montrer que",
  calculation: "Calculer",
  fill_blank: "Compléter",
  boolean: "Indépendance",
  essay: "Justifier",
}
```

---

## Step 4 — File detail page: show exam viewer

In `apps/web/app/(app)/groups/[groupId]/files/[fileId]/page.tsx`
(create if it doesn't exist):

```tsx
// If file.exam_metadata exists, show ExamDocumentViewer
// Otherwise show the regular file viewer / PDF embed

{file.exam_metadata ? (
  <ExamDocumentViewer
    header={file.exam_metadata.header}
    exercises={file.exam_metadata.exercises}
    onPractice={(exerciseIndex) => router.push(`/groups/${groupId}/exams/new?file=${fileId}&exercise=${exerciseIndex}`)}
    onGenerateSimilar={(exerciseIndex) => setGeneratingSimilar(exerciseIndex)}
  />
) : (
  <PDFViewer fileUrl={file.download_url} />
)}
```

---

## Step 5 — Level + branch selector in onboarding and group creation

When a user creates a group or sets up their profile, they should be able
to select their level and branch. Update:

**`apps/web/app/(app)/onboarding/page.tsx`** — add level selection step:

```tsx
function LevelSelector({ value, onChange }: {
  value: string | null
  onChange: (level: string) => void
}) {
  const cycles = {
    "Collège": ["1AC", "2AC", "3AC"],
    "Lycée — Tronc Commun": ["TC_S", "TC_L", "TC_O"],
    "1ère Baccalauréat": ["1BAC_SE", "1BAC_SM", "1BAC_SEG", "1BAC_L"],
    "2ème Baccalauréat": ["2BAC_SE", "2BAC_SM_A", "2BAC_SM_B", "2BAC_SEG", "2BAC_SH", "2BAC_L"],
  }

  const levelLabels: Record<string, string> = {
    "1AC": "1AC", "2AC": "2AC", "3AC": "3AC — Brevet",
    "TC_S": "TC Sciences", "TC_L": "TC Lettres", "TC_O": "TC Original",
    "1BAC_SE": "1BAC Sc. Exp.", "1BAC_SM": "1BAC Sc. Math", "1BAC_SEG": "1BAC SEG", "1BAC_L": "1BAC Lettres",
    "2BAC_SE": "2BAC Sc. Exp.", "2BAC_SM_A": "2BAC SM A", "2BAC_SM_B": "2BAC SM B",
    "2BAC_SEG": "2BAC SEG", "2BAC_SH": "2BAC Sc. Hum.", "2BAC_L": "2BAC Lettres",
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">What is your current level?</p>
      {Object.entries(cycles).map(([cycle, levels]) => (
        <div key={cycle}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{cycle}</p>
          <div className="flex flex-wrap gap-2">
            {levels.map(level => (
              <button
                key={level}
                onClick={() => onChange(level)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  value === level
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {levelLabels[level]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

Store the selected level in the user's profile via `PATCH /me/account`.
Use it to pre-populate the `level` field when generating exams.

---

## Step 6 — Concept knowledge map (Graph RAG UI)

Create `apps/web/app/(app)/groups/[groupId]/concepts/page.tsx`:

A visual overview of concepts extracted from this group's files.

```tsx
// Fetch GET /groups/:id/concepts
// Show as an interactive list (no heavy graph library needed — keep it simple)

function ConceptCard({ concept }: { concept: KnowledgeConcept }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800">{concept.name}</h3>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
          {concept.subject}
        </span>
      </div>
      <p className="text-xs text-slate-600 mb-2">{concept.definition}</p>
      {concept.formula && (
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <MathRenderer text={`$${concept.formula}$`} className="text-sm" />
        </div>
      )}
    </div>
  )
}
```

Add "Concepts" tab to the group page tab bar (alongside Chat, Files, etc.).

---

## Step 7 — Chat: show concept context

In the chat interface, when the RAG response includes matched concepts,
show a "Concepts used" chip strip above the response:

```tsx
{message.graph_concepts?.matched_concepts?.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-2">
    {message.graph_concepts.matched_concepts.map((c: any, i: number) => (
      <span key={i}
        className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"
        title={c.definition}
      >
        {c.name}
      </span>
    ))}
  </div>
)}
```

This requires the SSE stream to also emit a `{"type": "concepts", "data": {...}}` event — wire that in the backend RAG service alongside the existing `citations` event.

---

## Verification

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Check:
- MathRenderer renders inline and block LaTeX without errors
- ExamDocumentViewer displays all 4 sections from the sample exam
- LevelSelector shows all Moroccan levels in the correct groups
- Concept map page loads empty state correctly

Report TypeScript output.
