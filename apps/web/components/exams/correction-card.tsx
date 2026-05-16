"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, FileText, Lightbulb, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Correction } from "@/lib/hooks/use-exams";

const OPEN_TYPES = new Set(["open_calculation", "essay", "document_analysis", "construction_photo"]);
const TYPE_LABELS: Record<string, string> = {
  open_calculation: "Calculation",
  essay: "Essay",
  document_analysis: "Document",
  construction_photo: "Construction",
};

export function CorrectionCard({ correction, index }: { correction: Correction; index: number }) {
  const [expanded, setExpanded] = useState(correction.is_correct !== true);
  const c = correction;
  const isOpen = OPEN_TYPES.has(c.type);

  const studentText =
    c.student_answer && c.options
      ? `${c.student_answer}. ${c.options[c.student_answer] ?? ""}`
      : (c.student_answer ?? "(no answer)");
  const correctText = c.options
    ? `${c.correct_answer}. ${c.options[c.correct_answer] ?? ""}`
    : c.correct_answer;

  const statusLabel =
    c.is_correct === true
      ? "Correct"
      : c.is_correct === false
      ? "Incorrect"
      : (TYPE_LABELS[c.type] ?? "Open");

  const cardBg =
    c.is_correct === true
      ? "border-teal/30 bg-teal/5"
      : c.is_correct === false
      ? "border-destructive/30 bg-destructive/5"
      : "border-slate-200 bg-slate-50";

  return (
    <article className={cn("rounded-2xl border overflow-hidden transition-all", cardBg)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-black/[0.02]"
      >
        {c.is_correct === true ? (
          <CheckCircle2 size={18} className="text-teal shrink-0 mt-0.5" />
        ) : c.is_correct === false ? (
          <XCircle size={18} className="text-destructive shrink-0 mt-0.5" />
        ) : (
          <Minus size={18} className="text-slate-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Q{index + 1} · {c.difficulty} · {statusLabel}
            {c.points_max > 0 && (
              <span className="ml-1.5 normal-case font-normal">
                {c.points_earned != null
                  ? `${c.points_earned}/${c.points_max} pts`
                  : `/${c.points_max} pts`}
              </span>
            )}
          </p>
          <p className="text-sm font-medium text-primary line-clamp-2">{c.question}</p>
        </div>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-slate-400 mt-1 transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-3 animate-in">
          {/* MCQ options */}
          {c.options && (
            <ul className="space-y-1">
              {Object.entries(c.options).map(([letter, text]) => {
                const isCorrect = letter === c.correct_answer;
                const isStudent = letter === c.student_answer;
                return (
                  <li
                    key={letter}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                      isCorrect && "bg-teal/10 text-teal font-medium",
                      isStudent && !isCorrect && "bg-destructive/10 text-destructive line-through",
                      !isCorrect && !isStudent && "text-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0",
                        isCorrect
                          ? "bg-teal text-white border-teal"
                          : isStudent
                          ? "bg-destructive text-white border-destructive"
                          : "border-slate-300 text-slate-500"
                      )}
                    >
                      {letter}
                    </span>
                    <span>{text as string}</span>
                    {isCorrect && <CheckCircle2 size={14} className="ml-auto" />}
                    {isStudent && !isCorrect && <XCircle size={14} className="ml-auto" />}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Binary answer without options */}
          {!c.options && !isOpen && (
            <div className="space-y-1.5 text-sm">
              <p>
                Your answer:{" "}
                <span className={cn("font-medium", c.is_correct ? "text-teal" : "text-destructive")}>
                  {studentText}
                </span>
              </p>
              {!c.is_correct && (
                <p>
                  Correct answer: <span className="font-medium text-teal">{correctText}</span>
                </p>
              )}
            </div>
          )}

          {/* Open question: student response + AI feedback */}
          {isOpen && (
            <div className="space-y-2.5">
              {c.student_answer && (
                <div className="rounded-lg bg-white border border-slate-200 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                    Your answer
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {c.student_answer}
                  </p>
                </div>
              )}
              {c.feedback && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-400 mb-1.5 flex items-center gap-1">
                    <Lightbulb size={11} /> AI Feedback
                  </p>
                  <p className="text-sm text-indigo-900 leading-relaxed">{c.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Explanation for binary types */}
          {!isOpen && c.explanation && (
            <div className="rounded-lg bg-white border border-slate-200 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                <Lightbulb size={11} className="text-amber" /> Why
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{c.explanation}</p>
            </div>
          )}

          {c.source_passage && (
            <details className="rounded-lg border-l-4 border-accent bg-accent/5 p-3">
              <summary className="text-xs font-bold uppercase tracking-wide text-accent cursor-pointer flex items-center gap-1">
                <FileText size={11} /> Found in your course material
              </summary>
              <p className="mt-2 text-sm italic text-slate-700 leading-relaxed">{c.source_passage}</p>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
