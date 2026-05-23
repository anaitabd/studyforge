"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Copy, Trash2, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  useAddQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useDuplicateQuestion,
  type Exam,
  type Question,
} from "@/lib/hooks/use-exams";

// ── constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  mcq_single: "MCQ — single answer",
  mcq_multiple: "MCQ — multiple answers",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  open_calculation: "Calculation (open)",
  essay: "Essay",
  document_analysis: "Document analysis",
};

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const MCQ_LETTERS = ["A", "B", "C", "D"] as const;

// ── type helpers ─────────────────────────────────────────────────────────────

function isMCQ(t: string) { return t === "mcq_single" || t === "mcq_multiple"; }
function isTF(t: string) { return t === "true_false"; }
function isOpen(t: string) { return ["open_calculation", "essay", "fill_blank", "document_analysis"].includes(t); }

function optionsToArr(opts: Record<string, string> | null | undefined): [string, string, string, string] {
  if (!opts) return ["", "", "", ""];
  return MCQ_LETTERS.map((k) => opts[k] ?? "") as [string, string, string, string];
}

function arrToOptions(arr: [string, string, string, string]): Record<string, string> {
  const result: Record<string, string> = {};
  MCQ_LETTERS.forEach((k, i) => { if (arr[i].trim()) result[k] = arr[i].trim(); });
  return result;
}

// ── question form ────────────────────────────────────────────────────────────

interface FormState {
  id?: string;
  type: string;
  content: string;
  optionsArr: [string, string, string, string];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  points: number;
}

function defaultForm(partial: Partial<FormState> = {}): FormState {
  return {
    type: "mcq_single",
    content: "",
    optionsArr: ["", "", "", ""],
    correctAnswer: "A",
    explanation: "",
    difficulty: "medium",
    points: 1,
    ...partial,
  };
}

function QuestionForm({
  initial,
  groupId,
  examId,
  onCancel,
  onSaved,
}: {
  initial: FormState;
  groupId: string;
  examId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial.id;
  const add = useAddQuestion(groupId, examId);
  const upd = useUpdateQuestion(groupId, examId);
  const saving = add.isPending || upd.isPending;

  const [type, setType] = useState(initial.type);
  const [content, setContent] = useState(initial.content);
  const [opts, setOpts] = useState<[string, string, string, string]>(initial.optionsArr);
  const [correct, setCorrect] = useState(initial.correctAnswer || "A");
  const [explanation, setExplanation] = useState(initial.explanation);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [points, setPoints] = useState(initial.points);

  function handleTypeChange(t: string) {
    setType(t);
    setCorrect(isTF(t) ? "True" : "A");
  }

  function buildPayload() {
    return {
      type,
      content: content.trim(),
      options: isMCQ(type) ? arrToOptions(opts) : {},
      correct_answer: correct,
      explanation: explanation.trim() || null,
      difficulty,
      points,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) { toast.error("Question text is required"); return; }

    const payload = buildPayload();

    if (isEdit) {
      upd.mutate(
        { questionId: initial.id!, data: payload },
        {
          onSuccess: () => { toast.success("Saved"); onSaved(); },
          onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? "Error"),
        }
      );
    } else {
      add.mutate(payload, {
        onSuccess: () => { toast.success("Question added"); onSaved(); },
        onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? "Error"),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector — create only */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* Question content */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Question text</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          placeholder="Enter the question…"
        />
      </div>

      {/* MCQ options */}
      {isMCQ(type) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Options — click the letter to mark as correct
          </label>
          <div className="space-y-2">
            {MCQ_LETTERS.map((letter, i) => (
              <div key={letter} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(letter)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 text-xs font-bold shrink-0 transition-colors",
                    correct === letter
                      ? "border-accent bg-accent text-white"
                      : "border-slate-300 text-slate-500 hover:border-accent"
                  )}
                  title={`Mark ${letter} as correct`}
                >
                  {letter}
                </button>
                <input
                  type="text"
                  value={opts[i]}
                  onChange={(e) => {
                    const next = [...opts] as [string, string, string, string];
                    next[i] = e.target.value;
                    setOpts(next);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  placeholder={`Option ${letter}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* True / False */}
      {isTF(type) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Correct answer</label>
          <div className="flex gap-2">
            {["True", "False"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCorrect(v)}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                  correct === v
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-slate-300 text-slate-600 hover:border-slate-400"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Open-ended model answer */}
      {isOpen(type) && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Model answer / grading guide
          </label>
          <textarea
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
            placeholder="Expected answer or rubric notes…"
          />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Explanation <span className="text-slate-400 font-normal">(shown after submission)</span>
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          placeholder="Why is this the correct answer?"
        />
      </div>

      {/* Difficulty + Points */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-slate-600 mb-1">Points</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={points}
            onChange={(e) => setPoints(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {isEdit ? "Save changes" : "Add question"}
        </button>
      </div>
    </form>
  );
}

// ── question row ─────────────────────────────────────────────────────────────

function QuestionRow({
  question,
  index,
  groupId,
  examId,
}: {
  question: Question;
  index: number;
  groupId: string;
  examId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteQuestion(groupId, examId);
  const dup = useDuplicateQuestion(groupId, examId);

  const typeLabel = TYPE_LABELS[question.type] ?? question.type;
  const correctLabel = isMCQ(question.type) && question.correct_answer
    ? `Correct: ${question.correct_answer}`
    : isTF(question.type) && question.correct_answer
    ? `Answer: ${question.correct_answer}`
    : null;

  return (
    <li className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Summary row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug line-clamp-2">{question.content}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <span className="text-[11px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 leading-none">{typeLabel}</span>
            <span className="text-[11px] text-slate-400">{question.difficulty}</span>
            {correctLabel && (
              <span className="text-[11px] text-emerald-600 font-medium">{correctLabel}</span>
            )}
            <span className="text-[11px] text-slate-400">
              {question.points ?? 1} pt{(question.points ?? 1) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title="Duplicate"
            disabled={dup.isPending}
            onClick={() =>
              dup.mutate(question.id, {
                onSuccess: () => toast.success("Duplicated"),
                onError: (e: unknown) => toast.error((e as Error).message),
              })
            }
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
          >
            {dup.isPending && dup.variables === question.id
              ? <Loader2 size={13} className="animate-spin" />
              : <Copy size={13} />}
          </button>
          <button
            type="button"
            title="Delete"
            onClick={() => setConfirming(true)}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            title={expanded ? "Collapse" : "Edit"}
            onClick={() => { setExpanded((v) => !v); setConfirming(false); }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <QuestionForm
            initial={defaultForm({
              id: question.id,
              type: question.type,
              content: question.content,
              optionsArr: optionsToArr(question.options),
              correctAnswer: question.correct_answer ?? "",
              explanation: question.explanation ?? "",
              difficulty: question.difficulty,
              points: question.points ?? 1,
            })}
            groupId={groupId}
            examId={examId}
            onCancel={() => setExpanded(false)}
            onSaved={() => setExpanded(false)}
          />
        </div>
      )}

      {/* Delete confirmation */}
      {confirming && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-destructive">Delete this question?</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(question.id, {
                  onSuccess: () => { toast.success("Question deleted"); setConfirming(false); },
                  onError: (e: unknown) => toast.error((e as Error).message),
                })
              }
              className="px-3 py-1.5 rounded text-sm font-medium bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {del.isPending && <Loader2 size={11} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── exported component ────────────────────────────────────────────────────────

export function QuestionEditor({
  exam,
  groupId,
}: {
  exam: Exam & { questions?: Question[] };
  groupId: string;
}) {
  const [addingNew, setAddingNew] = useState(false);
  const questions = (exam.questions ?? []).slice().sort((a, b) => a.order_index - b.order_index);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
          {exam.total_points != null && ` · ${exam.total_points} pts total`}
        </p>
        <button
          type="button"
          onClick={() => setAddingNew((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={13} />
          Add question
        </button>
      </div>

      {/* New question form */}
      {addingNew && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 px-4 py-4">
          <p className="text-[11px] font-semibold text-accent uppercase tracking-wide mb-3">New question</p>
          <QuestionForm
            initial={defaultForm()}
            groupId={groupId}
            examId={exam.id}
            onCancel={() => setAddingNew(false)}
            onSaved={() => setAddingNew(false)}
          />
        </div>
      )}

      {questions.length === 0 && !addingNew ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-500 mb-3">No questions yet.</p>
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="text-sm text-accent hover:underline font-medium"
          >
            Add the first question →
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {questions.map((q, i) => (
            <QuestionRow key={q.id} question={q} index={i} groupId={groupId} examId={exam.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
