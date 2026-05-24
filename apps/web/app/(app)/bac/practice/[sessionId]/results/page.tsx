"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award, ChevronLeft, CheckCircle, XCircle, Clock, BookOpen,
  MessageSquare, RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useBacSession, useBacStats, useStartBacPractice, type BacQuestion, type QuestionScore } from "@/lib/hooks/use-bac";
import { cn } from "@/lib/utils";

function scoreBg(score: number) {
  if (score >= 16) return "bg-teal/10 text-teal border-teal/30";
  if (score >= 12) return "bg-amber/10 text-amber border-amber/30";
  if (score >= 10) return "bg-accent/10 text-accent border-accent/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function scoreLabel(score: number) {
  if (score >= 16) return "Excellent";
  if (score >= 14) return "Très bien";
  if (score >= 12) return "Bien";
  if (score >= 10) return "Passable";
  return "Insuffisant";
}

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { data: session, isLoading, isError } = useBacSession(sessionId);
  const { data: stats } = useBacStats();
  const { mutate: startPractice, isPending: restarting } = useStartBacPractice();
  const [feedbackLang, setFeedbackLang] = useState<"fr" | "ar">("fr");

  const handleRetry = () => {
    if (!session) return;
    startPractice(session.paper.id, {
      onSuccess: (data) => router.push(`/bac/practice/${data.session_id}`),
    });
  };

  if (isLoading) return <ResultsSkeleton />;
  if (isError || !session) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertTriangle size={32} className="text-destructive mb-4" />
        <p className="text-slate-600 mb-4">Résultats introuvables.</p>
        <Link href="/bac" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">
          Retour aux épreuves
        </Link>
      </div>
    );
  }

  if (session.grading_status === "grading" || session.grading_status === "pending") {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin mb-4" />
        <p className="text-slate-700 font-medium">Correction en cours…</p>
        <p className="text-slate-400 text-sm mt-1">L'IA analyse vos réponses. Rechargez dans quelques secondes.</p>
      </div>
    );
  }

  const score = session.score_over_20 ?? 0;
  const pqs = session.per_question_scores ?? {};
  const questions = session.questions;

  // Score history for this subject
  const subjectHistory = stats?.score_history.filter(
    (h) => h.subject === session.paper.subject
  ) ?? [];

  const timeSpent = session.submitted_at && session.started_at
    ? Math.round((new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/bac" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft size={14} />
        Retour aux épreuves
      </Link>

      {/* Score hero */}
      <div className={cn(
        "rounded-2xl border-2 p-8 flex flex-col sm:flex-row items-center gap-6",
        scoreBg(score)
      )}>
        {/* Circular score */}
        <ScoreCircle score={score} />

        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">
            {session.paper.title}
          </p>
          <h1 className="font-sora text-4xl font-bold">{score}/20</h1>
          <p className="text-lg font-semibold opacity-80 mt-1">{scoreLabel(score)}</p>
          <div className="flex items-center gap-4 mt-3 flex-wrap justify-center sm:justify-start">
            {timeSpent !== null && (
              <span className="flex items-center gap-1.5 text-sm opacity-70">
                <Clock size={13} />
                {timeSpent} min
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm opacity-70">
              <BookOpen size={13} />
              {questions.length} questions
            </span>
          </div>
        </div>

        <div className="sm:ml-auto flex flex-col gap-2">
          <button
            onClick={handleRetry}
            disabled={restarting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/40 backdrop-blur text-sm font-medium hover:bg-white/60 transition disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Recommencer
          </button>
        </div>
      </div>

      {/* Score history for this subject */}
      {subjectHistory.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Award size={15} className="text-accent" />
            Progression en {session.paper.subject}
          </h2>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={subjectHistory} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} tickLine={false} />
              <Tooltip
                formatter={(v) => [`${v}/20`, "Score"]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <ReferenceLine y={10} stroke="hsl(var(--destructive))" strokeDasharray="4 2" />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--accent))" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Feedback language toggle */}
      <div className="flex items-center gap-3">
        <h2 className="font-sora font-semibold text-primary text-lg">Correction détaillée</h2>
        <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setFeedbackLang("fr")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition",
              feedbackLang === "fr" ? "bg-accent text-white" : "hover:bg-slate-50 text-slate-600"
            )}
          >
            FR
          </button>
          <button
            onClick={() => setFeedbackLang("ar")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition",
              feedbackLang === "ar" ? "bg-accent text-white" : "hover:bg-slate-50 text-slate-600"
            )}
            dir="rtl"
          >
            عربية
          </button>
        </div>
      </div>

      {/* Question breakdown */}
      <div className="space-y-3">
        {questions.map((q, i) => {
          const qs = pqs[q.id];
          if (!qs) return null;
          return (
            <QuestionCard
              key={q.id}
              index={i + 1}
              question={q}
              score={qs}
              studentAnswer={session.answers[q.id] ?? ""}
              feedbackLang={feedbackLang}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Score circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const pct = (score / 20) * 100;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" opacity={0.15} />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sora font-bold text-2xl leading-none">{score}</span>
        <span className="text-xs opacity-70">/20</span>
      </div>
    </div>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  index, question, score, studentAnswer, feedbackLang,
}: {
  index: number;
  question: BacQuestion;
  score: QuestionScore;
  studentAnswer: string;
  feedbackLang: "fr" | "ar";
}) {
  const [expanded, setExpanded] = useState(false);
  const isCorrect = score.score === score.max_points;
  const isPartial = score.score > 0 && score.score < score.max_points;
  const pct = Math.round((score.score / score.max_points) * 100);

  return (
    <div className={cn(
      "rounded-xl border-2 bg-white overflow-hidden",
      isCorrect ? "border-teal/30" : isPartial ? "border-amber/30" : "border-destructive/20"
    )}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {isCorrect
          ? <CheckCircle size={18} className="text-teal shrink-0" />
          : isPartial
          ? <MessageSquare size={18} className="text-amber shrink-0" />
          : <XCircle size={18} className="text-destructive shrink-0" />
        }

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-slate-700">Question {index}</span>
            {question.part_label && (
              <span className="text-xs text-slate-400">{question.part_label}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{question.content.slice(0, 100)}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Mini progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", isCorrect ? "bg-teal" : isPartial ? "bg-amber" : "bg-destructive")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <span className={cn(
            "font-sora font-bold text-sm",
            isCorrect ? "text-teal" : isPartial ? "text-amber" : "text-destructive"
          )}>
            {score.score}/{score.max_points}
          </span>
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Student answer */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Votre réponse</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
              {studentAnswer || <span className="text-slate-400 italic">Sans réponse</span>}
            </p>
          </div>

          {/* Correct answer */}
          {!isCorrect && score.correct_answer && (
            <div>
              <p className="text-xs font-semibold text-teal/70 uppercase tracking-wider mb-1">Réponse attendue</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-teal/5 rounded-lg p-3 border border-teal/20">
                {score.correct_answer}
              </p>
            </div>
          )}

          {/* AI feedback */}
          <div>
            <p className="text-xs font-semibold text-accent/70 uppercase tracking-wider mb-1">Correction IA</p>
            <p
              className="text-sm text-slate-700 bg-accent/5 rounded-lg p-3 border border-accent/20 leading-relaxed"
              dir={feedbackLang === "ar" ? "rtl" : "ltr"}
            >
              {feedbackLang === "ar" ? score.feedback_ar : score.feedback_fr}
            </p>
          </div>

          {/* Criteria scores */}
          {score.criteria_scores && score.criteria_scores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Barème détaillé</p>
              <div className="space-y-1">
                {score.criteria_scores.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-600 flex-1">{c.criteria}</span>
                    <span className={cn(
                      "font-semibold shrink-0",
                      c.awarded === c.max ? "text-teal" : c.awarded > 0 ? "text-amber" : "text-destructive"
                    )}>
                      {c.awarded}/{c.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          {(feedbackLang === "fr" ? score.explanation_fr : score.explanation_ar) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Explication</p>
              <p
                className="text-sm text-slate-600 leading-relaxed"
                dir={feedbackLang === "ar" ? "rtl" : "ltr"}
              >
                {feedbackLang === "ar" ? score.explanation_ar : score.explanation_fr}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
