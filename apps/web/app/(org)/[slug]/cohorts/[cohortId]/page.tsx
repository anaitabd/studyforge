"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Users, CheckCircle, Activity, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCohort } from "@/lib/hooks/use-cohorts";
import { useCohortKpis } from "@/lib/hooks/use-org-kpis";
import {
  useCohortStudents,
  useCohortAssignments,
  useCohortLive,
  type CohortStudent,
  type CohortAssignment,
} from "@/lib/hooks/use-org-admin";
import { ScoreOver20 } from "@/components/org/score-over-20";

type Tab = "overview" | "students" | "assignments" | "live";

const SCORE_BUCKETS = [
  { label: "0–9", min: 0, max: 9, color: "#ef4444" },
  { label: "10–11", min: 10, max: 11, color: "#f59e0b" },
  { label: "12–13", min: 12, max: 13, color: "#84cc16" },
  { label: "14–15", min: 14, max: 15, color: "#22c55e" },
  { label: "16–20", min: 16, max: 20, color: "#10b981" },
];

function scoreDistribution(students: CohortStudent[]) {
  return SCORE_BUCKETS.map((b) => ({
    ...b,
    count: students.filter(
      (s) => s.avg_exam_score != null && s.avg_exam_score >= b.min && s.avg_exam_score <= b.max
    ).length,
  }));
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-emerald-100 text-emerald-700",
  graded: "bg-indigo-100 text-indigo-700",
};

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OverviewTab({ slug, cohortId }: { slug: string; cohortId: string }) {
  const { data: kpis, isLoading } = useCohortKpis(slug, cohortId);
  const { data: students } = useCohortStudents(slug, cohortId);
  const dist = students ? scoreDistribution(students) : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Avg score",
            value: isLoading ? "—" : <ScoreOver20 score={kpis?.avg_exam_score ?? null} size="lg" />,
            icon: <Activity size={18} />,
          },
          {
            label: "At-risk",
            value: isLoading ? "—" : (kpis?.at_risk_count ?? 0),
            icon: <AlertTriangle size={18} />,
            color: (kpis?.at_risk_count ?? 0) > 0 ? "text-red-500" : "text-emerald-500",
          },
          {
            label: "Active today",
            value: isLoading ? "—" : (kpis?.dau ?? 0),
            icon: <Users size={18} />,
            color: "text-teal-500",
          },
          {
            label: "Completion",
            value: isLoading ? "—" : "—",
            icon: <CheckCircle size={18} />,
            color: "text-emerald-500",
          },
        ].map(({ label, value, icon, color = "text-accent" }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className={`mb-2 ${color}`}>{icon}</div>
            <div className="text-2xl font-bold text-primary font-sora">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {dist.some((b) => b.count > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Score distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {dist.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StudentsTab({ slug, cohortId }: { slug: string; cohortId: string }) {
  const { data: students, isLoading } = useCohortStudents(slug, cohortId);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!students?.length) {
    return <p className="text-sm text-slate-400 text-center py-8">No students in this cohort.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Last active
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Avg score
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Paths
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Retention
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.user_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/org/${slug}/students/${s.user_id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 flex-shrink-0">
                      {s.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {relativeTime(s.last_active)}
                </td>
                <td className="px-4 py-3">
                  <ScoreOver20 score={s.avg_exam_score} size="sm" />
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {s.paths_completed}/{s.paths_total}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {s.flashcard_retention != null
                    ? `${Math.round(s.flashcard_retention * 100)}%`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {s.is_at_risk && (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      <AlertCircle className="w-3 h-3" /> At risk
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {students.map((s) => (
          <Link
            key={s.user_id}
            href={`/org/${slug}/students/${s.user_id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700 flex-shrink-0">
              {s.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{s.name}</p>
              <p className="text-xs text-slate-400">{relativeTime(s.last_active)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <ScoreOver20 score={s.avg_exam_score} size="sm" />
              {s.is_at_risk && (
                <span className="block text-[10px] text-red-600 font-medium mt-0.5">At risk</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AssignmentsTab({
  slug,
  cohortId,
}: {
  slug: string;
  cohortId: string;
}) {
  const { data: assignments, isLoading } = useCohortAssignments(slug, cohortId);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!assignments?.length) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">No assignments yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((a: CohortAssignment) => {
        const pct =
          a.total_count > 0 ? Math.round((a.submitted_count / a.total_count) * 100) : 0;
        return (
          <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.resource_type === "exam"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {a.resource_type === "exam" ? "Exam" : "Learning path"}
                </span>
                <h3 className="text-sm font-semibold text-slate-800 mt-1">{a.title}</h3>
              </div>
              {a.due_at && (
                <span className="text-xs text-slate-400 flex-shrink-0">
                  Due {new Date(a.due_at).toLocaleDateString("fr-MA")}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{a.submitted_count}/{a.total_count} submitted</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["not_started", "in_progress", "submitted", "graded"] as const).map((status) => (
                <div
                  key={status}
                  className={`rounded-lg p-2 text-center ${STATUS_COLORS[status]}`}
                >
                  <div className="text-lg font-bold">
                    {a.status_counts[status]}
                  </div>
                  <div className="text-[10px] capitalize">{status.replace("_", " ")}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveTab({ slug, cohortId }: { slug: string; cohortId: string }) {
  const { data: live, isLoading } = useCohortLive(slug, cohortId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-slate-700">
          {isLoading ? "—" : (live?.online_count ?? 0)} students online now
        </span>
        <span className="text-xs text-slate-400 ml-auto">Refreshes every 15s</span>
      </div>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !live?.students?.length && (
        <p className="text-sm text-slate-400 text-center py-6">No students online right now.</p>
      )}

      {live?.students?.map((student) => (
        <div
          key={student.id}
          className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2"
        >
          <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700">{student.name}</p>
            {student.current_file && (
              <p className="text-xs text-slate-500 truncate">
                Reading: {student.current_file}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">{student.last_active_ago}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CohortDetailPage() {
  const { slug, cohortId } = useParams<{ slug: string; cohortId: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const { data: cohort } = useCohort(slug, cohortId);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "students", label: "Students" },
    { id: "assignments", label: "Assignments" },
    { id: "live", label: "Live" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-400 mb-1">
          <Link href={`/org/${slug}/cohorts`} className="hover:underline">
            Cohorts
          </Link>{" "}
          /
        </p>
        <h1 className="font-sora text-2xl font-bold text-primary">
          {cohort?.name ?? "Cohort"}
        </h1>
        {cohort?.description && (
          <p className="text-slate-500 text-sm mt-1">{cohort.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id
                ? "border-accent text-accent"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab slug={slug} cohortId={cohortId} />}
      {tab === "students" && <StudentsTab slug={slug} cohortId={cohortId} />}
      {tab === "assignments" && <AssignmentsTab slug={slug} cohortId={cohortId} />}
      {tab === "live" && <LiveTab slug={slug} cohortId={cohortId} />}
    </div>
  );
}
