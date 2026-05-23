"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useExam } from "@/lib/hooks/use-exams";
import { useGroup } from "@/lib/hooks/use-groups";
import { QuestionEditor } from "@/components/exams/question-editor";

export default function EditExamPage({
  params,
}: {
  params: Promise<{ groupId: string; examId: string }>;
}) {
  const { groupId, examId } = use(params);
  const router = useRouter();
  const { data: group } = useGroup(groupId);
  const { data: exam, isLoading } = useExam(groupId, examId);

  const isTeacher = group?.my_role === "owner" || group?.my_role === "teacher";

  if (!isLoading && group && !isTeacher) {
    router.replace(`/groups/${groupId}/exams/${examId}`);
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/groups/${groupId}/exams`}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-5 w-48 rounded bg-slate-100 animate-pulse" />
          ) : (
            <>
              <h2 className="font-sora font-semibold text-primary truncate">{exam?.title}</h2>
              <p className="text-xs text-slate-500">Edit questions</p>
            </>
          )}
        </div>
      </div>

      {isLoading || !exam ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <QuestionEditor exam={exam} groupId={groupId} />
      )}
    </div>
  );
}
