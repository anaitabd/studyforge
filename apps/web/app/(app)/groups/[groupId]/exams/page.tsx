"use client";

import { use, useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { useExams } from "@/lib/hooks/use-exams";
import { useGroup } from "@/lib/hooks/use-groups";
import { ExamCard } from "@/components/exams/exam-card";
import { GenerateExamModal } from "@/components/exams/generate-exam-modal";

export default function ExamsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: exams, isLoading } = useExams(groupId);
  const { data: group } = useGroup(groupId);
  const canAssign = group?.my_role === "owner" || group?.my_role === "teacher";
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{exams?.length ?? 0} exam{(exams?.length ?? 0) !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          <Plus size={15} /> Generate exam
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (exams?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <GraduationCap className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-slate-500 text-sm mb-4">No exams yet — generate your first practice test.</p>
          <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent hover:underline font-medium">Generate now →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {exams!.map((e) => <ExamCard key={e.id} exam={e} groupId={groupId} canAssign={canAssign} />)}
        </div>
      )}

      <GenerateExamModal groupId={groupId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
