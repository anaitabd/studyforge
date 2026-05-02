"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useExam, useStartSession, useAutosave, useSubmitExam } from "@/lib/hooks/use-exams";
import { type Question } from "@/lib/hooks/use-exams";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function TakeExamPage({
  params,
}: {
  params: Promise<{ groupId: string; examId: string }>;
}) {
  const { groupId, examId } = use(params);
  const router = useRouter();
  const { data: exam, isLoading: examLoading } = useExam(groupId, examId);
  const { mutate: startSession, isPending: starting } = useStartSession(groupId, examId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutate: autosave } = useAutosave(groupId, examId, sessionId ?? "");
  const { mutate: submitExam, isPending: submitting } = useSubmitExam(groupId, examId, sessionId ?? "");

  // Start session on mount
  useEffect(() => {
    if (exam && !sessionId) {
      startSession(undefined, {
        onSuccess: (data) => {
          setSessionId(data.session_id);
          setQuestions(data.questions);
        },
        onError: (err) => toast.error((err as Error).message),
      });
    }
  }, [exam, sessionId, startSession]);

  // Autosave every 30s
  useEffect(() => {
    if (!sessionId || submitted) return;
    autosaveTimer.current = setInterval(() => {
      if (Object.keys(answers).length > 0) {
        autosave(answers);
      }
    }, 30_000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [sessionId, answers, autosave, submitted]);

  const handleAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  function handleSubmit() {
    if (!confirm("Submit exam? You cannot change your answers after submission.")) return;
    submitExam(answers, {
      onSuccess: (result) => {
        setSubmitted(true);
        router.push(`/groups/${groupId}/exams/${examId}/results/${result.session_id}`);
      },
      onError: (err) => toast.error((err as Error).message),
    });
  }

  if (examLoading || starting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!exam || questions.length === 0) return null;

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const total = questions.length;
  const progress = Math.round((answered / total) * 100);

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/groups/${groupId}/exams`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-slate-900">{exam.title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {answered}/{total} answered · {flagged.size} flagged
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Submit
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question navigator */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {questions.map((question, i) => (
          <button
            key={question.id}
            onClick={() => setCurrent(i)}
            className={cn(
              "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
              i === current
                ? "bg-primary text-white"
                : answers[question.id]
                ? "bg-emerald-100 text-emerald-700"
                : flagged.has(question.id)
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Question {current + 1} · {q.difficulty}
            </span>
            <p className="text-slate-900 font-medium mt-1 leading-relaxed">{q.content}</p>
          </div>
          <button
            onClick={() => toggleFlag(q.id)}
            className={cn(
              "p-1.5 rounded-lg transition-colors mt-1",
              flagged.has(q.id)
                ? "bg-amber-100 text-amber-600"
                : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
            )}
            title="Flag for review"
          >
            <Flag size={15} />
          </button>
        </div>

        {/* Options */}
        {q.options && (
          <div className="space-y-2">
            {q.options.map((opt, idx) => {
              const letter = ["A", "B", "C", "D"][idx] ?? String(idx + 1);
              const selected = answers[q.id] === letter;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(q.id, letter)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold",
                      selected ? "border-primary bg-primary text-white" : "border-slate-300 text-slate-500"
                    )}
                  >
                    {letter}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* True/False */}
        {q.type === "true_false" && !q.options && (
          <div className="flex gap-3">
            {["True", "False"].map((val) => (
              <button
                key={val}
                onClick={() => handleAnswer(q.id, val)}
                className={cn(
                  "flex-1 py-3 rounded-xl border text-sm font-medium transition-all",
                  answers[q.id] === val
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 hover:border-primary/40 text-slate-700"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            disabled={current === total - 1}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
