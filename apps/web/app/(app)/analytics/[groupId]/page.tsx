"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users, FileText, MessageSquare, GraduationCap, BookOpen, ChevronUp, ChevronDown, Download, type LucideIcon } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { useTeacherAnalytics } from "@/lib/hooks/useApi";
import { cn } from "@/lib/utils";

interface StudentStat { user_id: string; name: string; email: string; exams_taken: number; avg_score: number | null; chat_count: number; files_read?: number; active_minutes?: number; last_active?: string | null; joined_at: string; }
interface ExamSummary { id: string; title: string; status: string; submissions: number; avg_score: number | null; }
interface Analytics { group_id: string; group_name: string; member_count: number; student_count: number; file_count: number; total_chats: number; exam_count: number; avg_active_minutes?: number; students: StudentStat[]; exams: ExamSummary[]; }

type SortKey = "name" | "exams_taken" | "avg_score" | "chat_count" | "active_minutes";

export default function GroupAnalyticsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data, isLoading, isError } = useTeacherAnalytics(groupId);
  const a = data as Analytics | undefined;
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const students = useMemo(() => {
    if (!a) return [];
    return [...a.students].sort((x, y) => {
      const xv = x[sortKey] ?? -1;
      const yv = y[sortKey] ?? -1;
      const cmp = xv < yv ? -1 : xv > yv ? 1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
  }, [a, sortKey, dir]);

  function exportCSV() {
    if (!a) return;
    const rows = [
      ["Name", "Email", "Exams taken", "Avg score", "Chat msgs", "Joined"],
      ...a.students.map((s) => [s.name, s.email, s.exams_taken, s.avg_score ?? "", s.chat_count, s.joined_at]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${a.group_name}_students.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>;
  if (isError || !a) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">Access denied or analytics unavailable. This view requires teacher/owner role.</div>;

  return (
    <div>
      <Link href="/analytics" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-4">
        <ArrowLeft size={14} /> Back
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">{a.group_name}</h1>
          <p className="text-sm text-slate-500">Teacher dashboard</p>
        </div>
        <button type="button" onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium hover:bg-slate-50">
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <KPI icon={Users} label="Students" value={a.student_count} sub={`${a.member_count} total members`} />
        <KPI icon={FileText} label="Files" value={a.file_count} sub="indexed" />
        <KPI icon={MessageSquare} label="Chat msgs" value={a.total_chats} sub="all-time" />
        <KPI icon={GraduationCap} label="Exams" value={a.exam_count} sub="created" />
        <KPI icon={BookOpen} label="Avg reading" value={a.avg_active_minutes ?? 0} sub="minutes / session" />
      </div>

      <section className="mb-8">
        <h2 className="font-sora text-lg font-semibold text-primary mb-3">Exam performance</h2>
        {a.exams.length === 0 ? (
          <p className="text-sm text-slate-400">No exams yet.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a.exams.map((e) => ({ name: e.title.slice(0, 14), score: e.avg_score ?? 0, submissions: e.submissions }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {a.exams.map((e, i) => (
                    <Cell key={i} fill={(e.avg_score ?? 0) >= 70 ? "#0D9488" : (e.avg_score ?? 0) >= 50 ? "#D97706" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-sora text-lg font-semibold text-primary mb-3">Students</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {([
                  { key: "name", label: "Student" },
                  { key: "exams_taken", label: "Exams" },
                  { key: "avg_score", label: "Avg score" },
                  { key: "chat_count", label: "Chat msgs" },
                  { key: "active_minutes", label: "Reading min" },
                ] as const).map(({ key, label }) => {
                  const active = sortKey === key;
                  return (
                    <th
                      key={key}
                      onClick={() => { if (active) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(key); setDir("asc"); } }}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer hover:text-primary select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {active && (dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => {
                const stale = s.joined_at && Date.now() - new Date(s.joined_at).getTime() > 7 * 86400 * 1000 && (s.avg_score ?? 0) < 50;
                return (
                  <tr key={s.user_id} className={cn("hover:bg-slate-50", stale && "bg-destructive/5")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{s.name}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.exams_taken}</td>
                    <td className="px-4 py-3">
                      {s.avg_score !== null ? (
                        <span className={cn("font-medium", s.avg_score >= 70 ? "text-teal" : s.avg_score >= 50 ? "text-amber" : "text-destructive")}>
                          {s.avg_score}%
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.chat_count}</td>
                    <td className="px-4 py-3 text-slate-600">{s.active_minutes ?? 0}</td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">No students yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 mb-2 text-slate-500"><Icon size={13} /><p className="text-[10px] font-bold uppercase tracking-wider">{label}</p></div>
      <p className="font-sora text-2xl font-bold text-primary">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
