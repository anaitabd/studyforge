"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { CorrectionCard } from "@/components/exams/correction-card";
import { cn } from "@/lib/utils";

interface ResultData {
  session_id: string; score: number; total: number; percentage: number; time_spent_s: number;
  corrections?: Array<Parameters<typeof CorrectionCard>[0]["correction"]>;
}

export default function ResultsPage({ params }: { params: Promise<{ groupId: string; examId: string; sessionId: string }> }) {
  const { groupId, examId, sessionId } = use(params);
  const { data, isLoading } = useQuery<ResultData>({
    queryKey: ["exam-results", sessionId],
    queryFn: () => apiGet(`/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}`),
  });
  const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all");

  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>;
  }

  const mins = Math.floor(data.time_spent_s / 60);
  const secs = data.time_spent_s % 60;
  const grade = data.percentage >= 80 ? "Excellent" : data.percentage >= 60 ? "Good" : data.percentage >= 40 ? "Needs review" : "Keep going";
  const scoreColor = data.percentage >= 80 ? "text-teal" : data.percentage >= 50 ? "text-amber" : "text-destructive";

  const corrections = data.corrections ?? [];
  const filtered = corrections.filter((c) => filter === "all" || (filter === "correct" ? c.is_correct : !c.is_correct));

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/groups/${groupId}/exams`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-6">
        <ArrowLeft size={14} /> Back to exams
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 mb-8 text-center shadow-sm">
        <Trophy size={36} className="mx-auto text-amber mb-3" />
        <p className={cn("font-sora text-6xl font-bold", scoreColor)}>{data.percentage}%</p>
        <p className="text-slate-500 mt-2">{data.score} / {data.total} correct · <span className="font-medium">{grade}</span></p>
        <p className="text-xs text-slate-400 mt-1">Time: {mins}m {secs}s</p>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        {(["all", "correct", "incorrect"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors", filter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {f} {f !== "all" && `(${corrections.filter((c) => f === "correct" ? c.is_correct : !c.is_correct).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((c) => <CorrectionCard key={c.question_id} correction={c} index={corrections.indexOf(c)} />)}
      </div>
    </div>
  );
}
