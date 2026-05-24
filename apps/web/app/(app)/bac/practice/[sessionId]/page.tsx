"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Clock, ChevronLeft, ChevronRight, AlertTriangle, Send, CheckCircle } from "lucide-react";
import { useBacSession, useSubmitBacSession, type BacQuestion } from "@/lib/hooks/use-bac";
import { cn } from "@/lib/utils";

export default function PracticePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const { data: session, isLoading, isError } = useBacSession(sessionId);
  const { mutate: submitSession, isPending: submitting } = useSubmitBacSession();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Hydrate answers from server (for resumed sessions)
  useEffect(() => {
    if (session?.answers) setAnswers(session.answers);
  }, [session?.session_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute time remaining
  useEffect(() => {
    if (!session) return;
    if (session.submitted_at) {
      router.replace(`/bac/practice/${sessionId}/results`);
      return;
    }
    const startMs = new Date(session.started_at).getTime();
    const limitMs = session.duration_minutes * 60 * 1000;
    const deadline = startMs + limitMs;

    const tick = () => setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.started_at, session?.duration_minutes, session?.submitted_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(() => {
    if (!session) return;
    const startMs = new Date(session.started_at).getTime();
    const timeSpent = Math.round((Date.now() - startMs) / 1000);
    submitSession(
      { sessionId, answers, timeSpentS: timeSpent },
      {
        onSuccess: () => router.push(`/bac/practice/${sessionId}/results`),
        onError: () => toast.error("Erreur lors de la soumission. Réessayez."),
      }
    );
  }, [session, sessionId, answers, submitSession, router]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && session && !session.submitted_at && !submitting) {
      toast("Temps écoulé — soumission automatique…", { icon: "⏰" });
      handleSubmit();
    }
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PracticeSkeleton />;
  if (isError || !session) return <NotFound />;
  if (session.submitted_at) return <div className="p-8 text-slate-500 text-sm">Redirection…</div>;

  const questions = session.questions;
  const current = questions[currentIdx];
  const answeredCount = Object.values(answers).filter((a) => a.trim()).length;
  const progress = (currentIdx + 1) / questions.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{session.paper.title}</p>
            <p className="text-[11px] text-slate-400">
              {answeredCount}/{questions.length} réponses
            </p>
          </div>

          {/* Timer */}
          <TimerBadge seconds={timeLeft} />

          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{currentIdx + 1}/{questions.length}</span>
          </div>
        </div>
      </header>

      {/* Question body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Part label */}
        {current.part_label && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-xs font-semibold">
              {current.part_label}
            </span>
            {current.subject_area && (
              <span className="text-xs text-slate-400">{current.subject_area}</span>
            )}
          </div>
        )}

        {/* Question card */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-accent mb-1">
                Question {current.order_index} · {current.points} pt{current.points !== 1 ? "s" : ""}
              </p>
              <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
                {current.content}
              </p>
            </div>
            {answers[current.id]?.trim() && (
              <CheckCircle size={18} className="text-teal shrink-0 mt-1" />
            )}
          </div>

          <AnswerInput
            question={current}
            value={answers[current.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [current.id]: v }))}
          />
        </div>

        {/* Question navigator */}
        <div className="flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={cn(
                "w-9 h-9 rounded-lg text-xs font-semibold border-2 transition",
                i === currentIdx
                  ? "border-accent bg-accent text-white"
                  : answers[q.id]?.trim()
                  ? "border-teal/30 bg-teal/10 text-teal"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </main>

      {/* Sticky footer nav */}
      <footer className="sticky bottom-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Précédente</span>
          </button>

          <div className="flex-1" />

          {currentIdx < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
            >
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRight size={16} />
            </button>
          ) : null}

          <button
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition"
          >
            <Send size={14} />
            {submitting ? "Soumission…" : "Remettre la copie"}
          </button>
        </div>
      </footer>

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          answeredCount={answeredCount}
          total={questions.length}
          onConfirm={() => { setShowConfirm(false); handleSubmit(); }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Answer input component ───────────────────────────────────────────────────

function AnswerInput({
  question, value, onChange,
}: {
  question: BacQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  if (question.type === "mcq_single" && question.options) {
    const opts = Object.entries(question.options);
    return (
      <div className="space-y-2">
        {opts.map(([key, text]) => (
          <label
            key={key}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition",
              value === key
                ? "border-accent bg-accent/5"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <input
              type="radio"
              name={question.id}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="mt-0.5 accent-accent"
            />
            <span className="text-sm text-slate-700">
              <span className="font-semibold text-accent mr-2">{key}.</span>
              {text}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "true_false") {
    return (
      <div className="flex gap-3">
        {["Vrai", "Faux"].map((opt) => (
          <label
            key={opt}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-sm font-medium transition",
              value === opt ? "border-accent bg-accent/5 text-accent" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <input
              type="radio"
              name={question.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="sr-only"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "fill_blank") {
    return (
      <input
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Complétez ici…"
      />
    );
  }

  // open_calculation, essay, document_analysis
  return (
    <textarea
      className="input w-full min-h-[140px] resize-y leading-relaxed"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        question.type === "essay"
          ? "Rédigez votre rédaction ici…"
          : question.type === "document_analysis"
          ? "Analysez le document et répondez ici…"
          : "Développez votre solution étape par étape…"
      }
    />
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function TimerBadge({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <div className="w-20 h-7 bg-slate-100 rounded animate-pulse" />;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const urgent = seconds < 300;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-colors",
      urgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-slate-100 text-slate-700"
    )}>
      <Clock size={13} />
      {label}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  answeredCount, total, onConfirm, onCancel,
}: {
  answeredCount: number;
  total: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const unanswered = total - answeredCount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Send size={18} className="text-accent" />
          </div>
          <h2 className="font-sora font-semibold text-primary">Remettre la copie ?</h2>
        </div>
        {unanswered > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/5 p-3">
            <AlertTriangle size={15} className="text-amber shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700">
              {unanswered} question{unanswered > 1 ? "s" : ""} sans réponse. Vous ne pourrez pas modifier vos réponses après soumission.
            </p>
          </div>
        )}
        <p className="text-sm text-slate-600">
          {answeredCount}/{total} questions répondues. La correction IA prendra quelques secondes.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition"
          >
            Confirmer
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading / error states ───────────────────────────────────────────────────

function PracticeSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="h-10 w-64 bg-slate-100 rounded animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse" />)}
      </div>
    </div>
  );
}

function NotFound() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <AlertTriangle size={32} className="text-destructive mb-4" />
      <p className="text-slate-600 mb-4">Session introuvable ou accès non autorisé.</p>
      <button onClick={() => router.push("/bac")} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">
        Retour aux épreuves
      </button>
    </div>
  );
}
