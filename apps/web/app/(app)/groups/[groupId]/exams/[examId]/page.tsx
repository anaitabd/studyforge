"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useExam, useStartSession, useAutosave, useSubmitExam } from "@/lib/hooks/use-exams";
import { type Question } from "@/lib/hooks/use-exams";
import { QuestionRenderer } from "@/components/exams/QuestionRenderer";
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
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutate: autosave } = useAutosave(groupId, examId, sessionId ?? "");
  const { mutate: submitExam, isPending: submitting } = useSubmitExam(groupId, examId, sessionId ?? "");

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

  useEffect(() => {
    if (!sessionId || submitted) return;
    autosaveTimer.current = setInterval(() => {
      if (Object.keys(answers).length > 0) autosave(answers);
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

  function doSubmit() {
    submitExam(answers, {
      onSuccess: (result) => {
        setSubmitted(true);
        router.push(`/groups/${groupId}/exams/${examId}/results/${result.session_id}`);
      },
      onError: (err) => {
        toast.error((err as Error).message);
        setConfirmSubmit(false);
      },
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
  const answeredCount = questions.filter((question) => {
    const v = answers[question.id];
    return v !== undefined && v !== "";
  }).length;
  const total = questions.length;
  const progress = Math.round((answeredCount / total) * 100);

  return (
    <div className="max-w-2xl">
      {/* Submit confirmation modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-sora font-semibold text-primary mb-2">Submit exam?</h3>
            <p className="text-sm text-slate-600 mb-5">
              You have answered {answeredCount} of {total} questions. You cannot change your answers after submission.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/groups/${groupId}/exams`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-slate-900">{exam.title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {answeredCount}/{total} answered · {flagged.size} flagged
          </p>
        </div>
        <button
          onClick={() => setConfirmSubmit(true)}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          Submit
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question navigator */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {questions.map((question, i) => (
          <button
            key={question.id}
            onClick={() => setCurrent(i)}
            className={cn(
              "w-9 h-9 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500",
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
      <p className="text-xs text-slate-400 mb-6">{answeredCount} / {total} answered</p>

      {/* Question card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Question {current + 1} · {q.difficulty}
              </span>
              {q.points != null && (
                <span className="text-xs text-slate-400">
                  · Worth {q.points} pt{q.points !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-slate-900 font-medium leading-relaxed">{q.content}</p>
          </div>
          <button
            onClick={() => toggleFlag(q.id)}
            className={cn(
              "p-1.5 rounded-lg transition-colors mt-1 shrink-0",
              flagged.has(q.id)
                ? "bg-amber-100 text-amber-600"
                : "text-slate-300 hover:text-amber-500 hover:bg-amber-50"
            )}
            title="Flag for review"
          >
            <Flag size={15} />
          </button>
        </div>

        <QuestionRenderer
          question={q}
          answer={answers[q.id]}
          onAnswer={handleAnswer}
          groupId={groupId}
          examId={examId}
          sessionId={sessionId ?? ""}
        />

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            type="button"
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
