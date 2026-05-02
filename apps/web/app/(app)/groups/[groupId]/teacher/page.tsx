"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart2, FileText, MessageSquare, GraduationCap, Users } from "lucide-react";
import { useGroupAnalytics } from "@/lib/hooks/use-teacher";
import { StatCard } from "@/components/teacher/stat-card";
import { StudentsTable } from "@/components/teacher/students-table";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-50 text-blue-700",
  closed: "bg-slate-100 text-slate-400",
};

export default function TeacherDashboard({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data, isLoading, isError } = useGroupAnalytics(groupId);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/groups/${groupId}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Teacher Dashboard</h1>
          {data && <p className="text-sm text-slate-400 mt-0.5">{data.group_name}</p>}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          Access denied or analytics unavailable. This view requires owner or teacher role.
        </div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard label="Students" value={data.student_count} sub={`${data.member_count} total members`} />
            <StatCard label="Files" value={data.file_count} sub="ready for RAG" />
            <StatCard label="Chat messages" value={data.total_chats} sub="across all students" />
            <StatCard label="Exams" value={data.exam_count} sub="in this group" />
          </div>

          {/* Exams overview */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <GraduationCap size={17} className="text-slate-400" />
              Exam performance
            </h2>
            {data.exams.length === 0 ? (
              <p className="text-sm text-slate-400">No exams yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Exam</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Submissions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Avg score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <Link
                            href={`/groups/${groupId}/exams/${exam.id}`}
                            className="hover:text-primary hover:underline"
                          >
                            {exam.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize", STATUS_STYLES[exam.status] ?? STATUS_STYLES.draft)}>
                            {exam.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{exam.submissions}</td>
                        <td className="px-4 py-3">
                          {exam.avg_score !== null ? (
                            <span className={cn("font-medium", exam.avg_score >= 80 ? "text-emerald-600" : exam.avg_score >= 50 ? "text-amber-600" : "text-red-600")}>
                              {exam.avg_score}%
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Students table */}
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Users size={17} className="text-slate-400" />
              Student overview
            </h2>
            <StudentsTable students={data.students} />
          </section>
        </>
      )}
    </div>
  );
}
