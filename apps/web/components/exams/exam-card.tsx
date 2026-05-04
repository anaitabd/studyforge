"use client";

import Link from "next/link";
import { GraduationCap, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Exam } from "@/lib/hooks/useApi";

const STATUS = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600" },
  assigned: { label: "Active", color: "bg-teal/10 text-teal" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-400" },
} as const;

export function ExamCard({ exam, groupId }: { exam: Exam; groupId: string }) {
  const cfg = STATUS[exam.status] ?? STATUS.draft;
  const config = exam.config as { question_count?: number; question_type?: string };

  let deadline: string | null = null;
  let urgent = false;
  if (exam.ends_at) {
    const ms = new Date(exam.ends_at).getTime() - Date.now();
    if (ms > 0) {
      const hrs = ms / 36e5;
      deadline = `Due ${formatDistanceToNow(new Date(exam.ends_at), { addSuffix: true })}`;
      urgent = hrs < 24;
    }
  }

  return (
    <Link
      href={`/groups/${groupId}/exams/${exam.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <GraduationCap size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-sora font-semibold text-primary truncate flex-1">{exam.title}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", cfg.color)}>{cfg.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {config.question_count ?? "?"} questions
            {config.question_type && ` · ${String(config.question_type).replace("_", " ")}`}
          </p>
          {deadline && (
            <p className={cn("text-xs mt-2 flex items-center gap-1", urgent ? "text-amber font-medium" : "text-slate-500")}>
              <Clock size={11} /> {deadline}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
