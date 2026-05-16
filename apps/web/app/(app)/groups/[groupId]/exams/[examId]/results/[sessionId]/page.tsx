"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, BookOpen, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { CorrectionCard } from "@/components/exams/correction-card";
import type { Correction } from "@/lib/hooks/use-exams";
import { cn } from "@/lib/utils";

interface ResultData {
  session_id: string;
  score: number;
  total: number;
  score_over_20: number | null;
  passed: boolean | null;
  grading_status: string;
  percentage: number;
  time_spent_s: number;
  ai_summary: string | null;
  weak_areas: string[];
  study_recommendations: string[];
  corrections?: Correction[];
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ groupId: string; examId: string; sessionId: string }>;
}) {
  const { groupId, examId, sessionId } = use(params);
  const { data, isLoading } = useQuery<ResultData>({
    queryKey: ["exam-results", sessionId],
    queryFn: () =>
      apiGet(`/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}`),
  });
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all");

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const mins = Math.floor(data.time_spent_s / 60);
  const secs = data.time_spent_s % 60;
  const grade =
    data.percentage >= 80
      ? "Excellent"
      : data.percentage >= 60
      ? "Good"
      : data.percentage >= 40
      ? "Needs review"
      : "Keep going";
  const scoreColor =
    data.percentage >= 80
      ? "text-teal"
      : data.percentage >= 50
      ? "text-amber"
      : "text-destructive";

  const corrections = data.corrections ?? [];
  const filtered = corrections.filter((c) =>
    filter === "all"
      ? true
      : filter === "correct"
      ? c.is_correct === true
      : c.is_correct !== true
  );
  const correctCount = corrections.filter((c) => c.is_correct === true).length;
  const incorrectCount = corrections.filter((c) => c.is_correct !== true).length;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/groups/${groupId}/exams`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-6"
      >
        <ArrowLeft size={14} /> Back to exams
      </Link>

      {/* Score card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 mb-6 text-center shadow-sm">
        <Trophy size={36} className="mx-auto text-amber mb-3" />
        {data.score_over_20 != null ? (
          <>
            <p className={cn("font-sora text-6xl font-bold", scoreColor)}>
              {data.score_over_20.toFixed(1)}
              <span className="text-3xl text-slate-400 font-normal">/20</span>
            </p>
            <p className="text-slate-500 mt-2">
              {data.percentage}% · <span className="font-medium">{grade}</span>
              {data.passed != null && (
                <span
                  className={cn(
                    "ml-2 text-xs font-semibold px-2 py-0.5 rounded-full",
                    data.passed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {data.passed ? "Passed" : "Failed"}
                </span>
              )}
            </p>
          </>
        ) : data.grading_status === "pending" ? (
          <>
            <p className="font-sora text-2xl font-semibold text-slate-700 mb-1">Grading in progress</p>
            <p className="text-sm text-slate-500">Open questions are being evaluated by AI. Refresh in a moment.</p>
          </>
        ) : (
          <>
            <p className={cn("font-sora text-6xl font-bold", scoreColor)}>{data.percentage}%</p>
            <p className="text-slate-500 mt-2">
              {data.score} / {data.total} correct · <span className="font-medium">{grade}</span>
            </p>
          </>
        )}
        <p className="text-xs text-slate-400 mt-1">
          Time: {mins}m {secs}s
        </p>
      </div>

      {/* AI Summary */}
      {data.ai_summary && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 mb-5 flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <Brain size={16} className="text-indigo-600" />
          </div>
          <p className="text-sm text-indigo-900 leading-relaxed">{data.ai_summary}</p>
        </div>
      )}

      {/* Weak areas + Study plan */}
      {((data.weak_areas ?? []).length > 0 || (data.study_recommendations ?? []).length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {(data.weak_areas ?? []).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
                Areas to review
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.weak_areas.map((area) => (
                  <span
                    key={area}
                    className="text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(data.study_recommendations ?? []).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5 flex items-center gap-1.5">
                <BookOpen size={12} /> Study plan
              </p>
              <ul className="space-y-1.5">
                {data.study_recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] flex items-center justify-center shrink-0 font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Per-question breakdown */}
      {corrections.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { key: "all", label: "All", count: corrections.length },
                { key: "correct", label: "Correct", count: correctCount },
                { key: "incorrect", label: "Incorrect / Open", count: incorrectCount },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                type="button"
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  filter === key
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">
              No questions in this category.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <CorrectionCard
                  key={c.question_id}
                  correction={c}
                  index={corrections.indexOf(c)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
