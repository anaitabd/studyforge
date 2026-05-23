"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Clock, Users, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useAssignExam } from "@/lib/hooks/use-exams";
import toast from "react-hot-toast";
import type { Exam } from "@/lib/hooks/useApi";

const STATUS = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-600" },
  assigned: { label: "Active", color: "bg-teal/10 text-teal" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-400" },
} as const;

function AssignModal({ groupId, exam, onClose }: { groupId: string; exam: Exam; onClose: () => void }) {
  const [endsAt, setEndsAt] = useState("");
  const [attemptLimit, setAttemptLimit] = useState(1);
  const assign = useAssignExam(groupId, exam.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await assign.mutateAsync({ ends_at: endsAt || undefined, attempt_limit: attemptLimit });
    toast.success("Examen assigné aux élèves !");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sora font-semibold text-primary mb-1">Assigner l&apos;examen</h3>
        <p className="text-sm text-slate-500 mb-4">{exam.title}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date limite (optionnel)</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tentatives max</label>
            <select
              value={attemptLimit}
              onChange={(e) => setAttemptLimit(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={assign.isPending} className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
              {assign.isPending ? "En cours…" : "Assigner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExamCard({ exam, groupId, canAssign }: { exam: Exam; groupId: string; canAssign?: boolean }) {
  const cfg = STATUS[exam.status] ?? STATUS.draft;
  const config = exam.config as { question_count?: number; question_type?: string };
  const [assigning, setAssigning] = useState(false);

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
    <>
      <div className="rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all">
        <Link href={`/groups/${groupId}/exams/${exam.id}`} className="block p-5">
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

        {canAssign && exam.status === "draft" && (
          <div className="px-5 pb-4 pt-0 flex gap-2">
            <Link
              href={`/groups/${groupId}/exams/${exam.id}/edit`}
              className="flex-1 flex items-center gap-1.5 justify-center px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 font-medium transition-colors"
            >
              <Pencil size={11} /> Edit questions
            </Link>
            <button
              type="button"
              onClick={() => setAssigning(true)}
              className="flex-1 flex items-center gap-1.5 justify-center px-3 py-1.5 rounded-lg border border-accent/30 text-xs text-accent hover:bg-accent/5 font-medium transition-colors"
            >
              <Users size={11} /> Assign
            </button>
          </div>
        )}
      </div>

      {assigning && <AssignModal groupId={groupId} exam={exam} onClose={() => setAssigning(false)} />}
    </>
  );
}
