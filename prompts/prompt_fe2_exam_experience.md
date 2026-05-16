# StudyForge Frontend — Prompt FE-2: Enhanced Exam Experience

## Read first
```
cat prompts/prompt_fe0_design_system.md
cat apps/web/app/\(app\)/groups/\[groupId\]/exams/page.tsx
cat apps/web/app/\(app\)/groups/\[groupId\]/exams/\[examId\]/page.tsx
cat apps/web/lib/hooks/use-exams.ts
```

Do not write code until you have read all of the above.

---

## What you are building

The exam experience needs to handle 5 question types, show /20 scores,
display rubric-based feedback, and allow photo uploads for construction
questions. Every change must work on mobile.

---

## Part 1 — Exam question types

Find the exam taker page (`/groups/[id]/exams/[examId]/page.tsx` or similar).
It currently renders MCQ, true-false, and fill-blank. Extend it with these:

### open_calculation question
```tsx
// Student types out their calculation steps + final answer
// Two fields: a textarea for steps, a text input for final answer
function OpenCalculationInput({ questionId, value, onChange }: {
  questionId: string
  value: { text: string }
  onChange: (v: { text: string }) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
          Your working / calculation steps
        </label>
        <textarea
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          placeholder="Write your calculation steps here..."
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1">
        <span>💡</span> Show all your working — partial credit is awarded for correct steps even if the final answer is wrong.
      </p>
    </div>
  )
}
```

### essay question
```tsx
function EssayInput({ questionId, value, onChange, wordCountGuide }: {
  questionId: string
  value: { text: string }
  onChange: (v: { text: string }) => void
  wordCountGuide?: string
}) {
  const wordCount = value.text.trim().split(/\s+/).filter(Boolean).length
  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700 min-h-[200px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        placeholder="Write your essay response here..."
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{wordCount} words{wordCountGuide ? ` (guide: ${wordCountGuide})` : ''}</span>
        <span>Auto-saved</span>
      </div>
    </div>
  )
}
```

### document_analysis question
The question object has `document_text`, `document_type`, and `sub_questions`.
Each sub-question needs its own answer field.
```tsx
function DocumentAnalysisInput({ question, value, onChange }: {
  question: {
    document_text: string
    document_type: string
    sub_questions: Array<{ question: string; points: number; answer_type: string }>
  }
  value: { sub_answers: Record<string, string> }
  onChange: (v: { sub_answers: Record<string, string> }) => void
}) {
  return (
    <div className="space-y-4">
      {/* Document display */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          {question.document_type === 'text' ? 'Read the following text' : 'Study the document below'}
        </p>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {question.document_text}
        </p>
      </div>
      {/* Sub-questions */}
      <div className="space-y-4">
        {question.sub_questions.map((sq, i) => (
          <div key={i} className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              <span className="text-indigo-600 font-semibold">{i + 1}.</span> {sq.question}
              <span className="ml-2 text-xs text-slate-400">({sq.points} pts)</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 min-h-[80px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Your answer..."
              value={value.sub_answers[String(i)] || ''}
              onChange={(e) => onChange({
                sub_answers: { ...value.sub_answers, [String(i)]: e.target.value }
              })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### construction_photo question
This is the most important mobile-first component. The student photographs
their geometric construction work.
```tsx
function ConstructionPhotoInput({ questionId, sessionId, examId, groupId, onUploaded }: {
  questionId: string
  sessionId: string
  examId: string
  groupId: string
  onUploaded: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadPhoto } = useUploadConstructionPhoto(groupId, examId, sessionId)

  const handleFile = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please use a JPEG, PNG, or WebP photo.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo must be under 10MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      await uploadPhoto({ questionId, file })
      setUploaded(true)
      onUploaded()
      toast.success('Photo uploaded.')
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Instructions banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <p className="font-medium mb-1">📐 Construction question</p>
        <p className="text-xs">Complete the construction on paper, then take a clear photo of your work and upload it below.</p>
      </div>

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          uploaded ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"  // opens camera on mobile
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {preview ? (
          <div className="space-y-2">
            <img src={preview} alt="Construction preview" className="max-h-48 mx-auto rounded-lg object-contain" />
            {uploaded && (
              <div className="flex items-center justify-center gap-1 text-emerald-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Uploaded successfully
              </div>
            )}
            {!uploaded && (
              <p className="text-xs text-slate-500">
                {uploading ? 'Uploading...' : 'Tap to change photo'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-600">Take a photo or upload</p>
            <p className="text-xs text-slate-400">JPEG, PNG, WebP — max 10MB</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
```

Wire all 5 question types into a single `<QuestionRenderer>` component
that switches on `question.type`. Place it in
`apps/web/components/exams/QuestionRenderer.tsx`.

---

## Part 2 — Question navigation bar

Replace any existing numbered navigation with a proper status bar:

```tsx
function QuestionNav({ questions, answers, current, onSelect }: {
  questions: Array<{ id: string; type: string; points: number }>
  answers: Record<string, unknown>
  current: number
  onSelect: (i: number) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {questions.map((q, i) => {
        const answered = !!answers[q.id]
        const isCurrent = i === current
        return (
          <button
            key={q.id}
            onClick={() => onSelect(i)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
              isCurrent
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                : answered
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {i + 1}
          </button>
        )
      })}
    </div>
  )
}
```

Show a progress indicator: "8 / 12 answered" above the nav. Show points
per question under each question title: "Worth 3.0 pts".

---

## Part 3 — Exam results page

The results endpoint now returns: `score_over_20`, `passed`,
`grading_status`, `per-question feedback`, `ai_summary`, `weak_areas`,
`study_recommendations`.

Build a completely new results page at
`apps/web/app/(app)/groups/[groupId]/exams/[examId]/results/page.tsx`:

### Header section
```tsx
// Large score display
<div className="text-center py-8">
  <ScoreOver20 score={result.score_over_20} size="lg" />
  <div className="mt-2">
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
      result.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
    }`}>
      {result.passed ? '✓ Passed' : '✗ Not passed'} — passing mark: 10/20
    </span>
  </div>
  {result.grading_status === 'pending' && (
    <p className="text-sm text-slate-500 mt-2">
      Open-ended answers are being graded by AI...
    </p>
  )}
</div>
```

### AI summary card
```tsx
{result.ai_summary && (
  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
        <Brain className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-indigo-900 mb-1">AI Feedback</p>
        <p className="text-sm text-indigo-800">{result.ai_summary}</p>
      </div>
    </div>
  </div>
)}
```

### Weak areas + study plan
```tsx
{result.weak_areas?.length > 0 && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" /> Areas to review
      </h3>
      <ul className="space-y-2">
        {result.weak_areas.map((area: string, i: number) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
            {area}
          </li>
        ))}
      </ul>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-indigo-500" /> Study plan
      </h3>
      <ul className="space-y-2">
        {result.study_recommendations.map((rec: string, i: number) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 flex-shrink-0" />
            {rec}
          </li>
        ))}
      </ul>
    </div>
  </div>
)}
```

### Per-question breakdown
For each question, show: the question text, student answer, points
earned/max, type-specific feedback.

For `essay` type: show category_scores as a mini rubric grid.
For `open_calculation` type: show step_scores as a checklist.
For `construction_photo` type: show the step_results with found/not found icons.
For `mcq`/`true_false`: show is_correct with green/red styling.

```tsx
function QuestionResult({ question, scoreData }: {
  question: { type: string; content: string; options?: Record<string, string>; correct_answer: string }
  scoreData: { score?: number; max_points?: number; feedback?: string; category_scores?: any[]; step_scores?: any[] }
}) {
  const earned = scoreData?.score ?? null
  const max = scoreData?.max_points ?? question.points
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-700 font-medium">{question.content}</p>
        {earned !== null && (
          <span className={`flex-shrink-0 text-sm font-bold ${earned >= max * 0.5 ? 'text-emerald-600' : 'text-red-600'}`}>
            {earned}/{max}
          </span>
        )}
      </div>
      {/* Type-specific feedback */}
      {scoreData?.feedback && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3">
          {scoreData.feedback}
        </p>
      )}
      {/* Essay rubric */}
      {scoreData?.category_scores?.map((cat: any, i: number) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">{cat.category.replace(/_/g, ' ')}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${(cat.score / cat.max_points) * 100}%` }}
              />
            </div>
            <span className="font-medium text-slate-700">{cat.score}/{cat.max_points}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## Part 4 — Exam generation form update

The `GenerateExamRequest` schema changed. The generate form in
`/groups/[id]/generate` must be updated:

- Remove `question_type` (single select) — it's now optional `question_types`
- Add optional `subject_area` select: Math | French | Arabic | Sciences | Physics | History-Geography
- Add optional `level` select: 1AC | 2AC | 3AC | TC | 1BAC | 2BAC
- Show help text: "Leave blank for auto-detection from your files"
- `title` is now optional — show a placeholder: "Auto-generated if left blank"
- Show new info chip: "Exam scored /20 — Moroccan curriculum"

---

## Verification

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

All TypeScript errors must be resolved. Report the output.
