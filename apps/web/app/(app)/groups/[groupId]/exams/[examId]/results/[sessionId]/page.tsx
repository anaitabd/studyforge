"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, ArrowLeft, Trophy } from "lucide-react";
import api from "@/lib/api";
import { type GradingResult } from "@/lib/hooks/use-exams";
import { cn } from "@/lib/utils";

function useResults(groupId: string, examId: string, sessionId: string) {
  return useQuery<GradingResult>({
    queryKey: ["exam-results", sessionId],
    queryFn: async () => {
      const res = await api.get(
        `/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}`
      );
      return res.data;
    },
  });
}

export default function ResultsPage({
  params,
}: {
  params: Promise<{ groupId: string; examId: string; sessionId: string }>;
}) {
  const { groupId, examId, sessionId } = use(params);
  const { data, isLoading } = useResults(groupId, examId, sessionId);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const mins = Math.floor(data.time_spent_s / 60);
  const secs = data.time_spent_s % 60;
  const scoreColor =
    data.percentage >= 80
      ? "text-emerald-600"
      : data.percentage >= 50
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/groups/${groupId}/exams`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-slate-900">Results</h1>
      </div>

      {/* Score summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center mb-8 shadow-sm">
        <Trophy size={32} className="mx-auto mb-3 text-amber-400" />
        <p className={cn("text-5xl font-bold", scoreColor)}>{data.percentage}%</p>
        <p className="text-slate-500 mt-2">
          {data.score} / {data.total} correct
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Time: {mins}m {secs}s
        </p>
      </div>

      {/* Per-question corrections */}
      <div className="space-y-4">
        {data.corrections.map((c, i) => (
          <div
            key={c.question_id}
            className={cn(
              "rounded-2xl border p-5",
              c.is_correct ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"
            )}
          >
            <div className="flex items-start gap-3">
              {c.is_correct ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-500 mt-0.5" />
              ) : (
                <XCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {i + 1}. {c.question}
                </p>

                <div className="mt-2 space-y-1 text-xs">
                  {c.student_answer && (
                    <p className={cn(c.is_correct ? "text-emerald-700" : "text-red-700")}>
                      Your answer: <span className="font-medium">{c.student_answer}</span>
                    </p>
                  )}
                  {!c.is_correct && (
                    <p className="text-emerald-700">
                      Correct answer: <span className="font-medium">{c.correct_answer}</span>
                    </p>
                  )}
                </div>

                {c.explanation && (
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed bg-white rounded-lg px-3 py-2 border border-slate-200">
                    {c.explanation}
                  </p>
                )}

                {c.source_passage && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                      Source passage
                    </summary>
                    <p className="mt-1 text-xs text-slate-500 italic leading-relaxed border-l-2 border-slate-300 pl-3">
                      {c.source_passage}
                    </p>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
