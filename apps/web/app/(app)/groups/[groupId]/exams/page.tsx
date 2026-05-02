"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, GraduationCap } from "lucide-react";
import { useExams } from "@/lib/hooks/use-exams";
import { GenerateExamModal } from "@/components/exams/generate-exam-modal";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-50 text-blue-700",
  closed: "bg-slate-100 text-slate-400",
};

export default function ExamsListPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: exams, isLoading } = useExams(groupId);
  const [showGenerate, setShowGenerate] = useState(false);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/groups/${groupId}`}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex-1">Exams</h1>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={15} />
          Generate
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {exams && exams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <GraduationCap size={32} className="text-slate-300" />
          <p className="text-slate-500 text-sm">No exams yet.</p>
          <button onClick={() => setShowGenerate(true)} className="text-sm text-primary hover:underline">
            Generate your first exam →
          </button>
        </div>
      )}

      {exams && exams.length > 0 && (
        <ul className="space-y-2">
          {exams.map((exam) => (
            <li key={exam.id}>
              <Link
                href={`/groups/${groupId}/exams/${exam.id}`}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{exam.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatRelative(exam.created_at)}</p>
                </div>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                    STATUS_STYLES[exam.status]
                  )}
                >
                  {exam.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <GenerateExamModal groupId={groupId} open={showGenerate} onClose={() => setShowGenerate(false)} />
    </div>
  );
}
