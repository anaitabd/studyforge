"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Users,
  Award,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useOrgKpisOverview, useAtRiskStudents, useCohortsKpis } from "@/lib/hooks/use-org-kpis";
import { useDauTrend } from "@/lib/hooks/use-org-admin";
import { ScoreOver20 } from "@/components/org/score-over-20";

function KpiCard({
  label,
  value,
  subvalue,
  icon,
  color = "text-accent",
  alert,
  linkHref,
}: {
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  icon: React.ReactNode;
  color?: string;
  alert?: boolean;
  linkHref?: string;
}) {
  const inner = (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
        alert ? "border-red-200 bg-red-50" : "border-slate-200"
      } ${linkHref ? "hover:border-accent/40 cursor-pointer" : ""}`}
    >
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-primary font-sora">{value}</div>
      {subvalue && <div className="text-xs text-slate-400 mt-0.5">{subvalue}</div>}
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
  return linkHref ? <Link href={linkHref}>{inner}</Link> : inner;
}

export default function OrgDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: kpis, isLoading } = useOrgKpisOverview(slug);
  const { data: cohorts, isLoading: cohortsLoading } = useCohortsKpis(slug);
  const { data: atRisk } = useAtRiskStudents(slug);
  const { data: dauTrend } = useDauTrend(slug);

  const skeleton = <span className="text-slate-300 animate-pulse">—</span>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">
          Engagement and performance across your organisation.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Daily active"
          value={isLoading ? skeleton : (kpis?.dau ?? 0)}
          subvalue={kpis ? `WAU: ${kpis.wau}` : undefined}
          icon={<Users size={20} />}
        />
        <KpiCard
          label="Avg exam score"
          value={
            isLoading ? skeleton :
            kpis?.avg_exam_score != null
              ? <ScoreOver20 score={kpis.avg_exam_score} size="lg" />
              : "—"
          }
          icon={<Award size={20} />}
          color={
            kpis?.avg_exam_score != null && kpis.avg_exam_score >= 10
              ? "text-emerald-500"
              : "text-red-500"
          }
        />
        <KpiCard
          label="Path completion"
          value={
            isLoading ? skeleton :
            kpis?.completion_rate != null
              ? `${Math.round(kpis.completion_rate * 100)}%`
              : "—"
          }
          icon={<CheckCircle size={20} />}
          color="text-teal-500"
        />
        <KpiCard
          label="At-risk students"
          value={isLoading ? skeleton : (kpis?.at_risk_count ?? 0)}
          icon={<AlertTriangle size={20} />}
          color={kpis?.at_risk_count ? "text-red-500" : "text-emerald-500"}
          alert={(kpis?.at_risk_count ?? 0) > 0}
          linkHref={`/org/${slug}/at-risk`}
        />
        <KpiCard
          label="Enrolled"
          value={isLoading ? skeleton : (kpis?.dau != null ? "—" : "—")}
          icon={<UserCheck size={20} />}
          color="text-indigo-500"
        />
      </div>

      {/* DAU trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Daily active users — last 30 days
        </h2>
        {dauTrend && dauTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={dauTrend}>
              <defs>
                <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                fill="url(#dauGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400">
            No activity data yet.
          </div>
        )}
      </div>

      {/* Cohort summary table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Cohorts</h2>
          <Link
            href={`/org/${slug}/cohorts`}
            className="text-xs text-indigo-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {cohortsLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : !cohorts?.length ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">
            No cohorts yet. Create one to get started.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {cohorts.map((cohort) => (
              <Link
                key={cohort.cohort_id}
                href={`/org/${slug}/cohorts/${cohort.cohort_id}`}
                className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{cohort.name}</p>
                  <p className="text-xs text-slate-400">{cohort.dau} active today</p>
                </div>
                <div className="flex items-center gap-6 ml-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Avg score</p>
                    <ScoreOver20 score={cohort.avg_exam_score} size="sm" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">At-risk</p>
                    <p
                      className={`text-sm font-medium ${
                        cohort.at_risk_count > 0 ? "text-red-600" : "text-slate-700"
                      }`}
                    >
                      {cohort.at_risk_count}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* At-risk alert panel */}
      {(atRisk ?? []).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">
              {atRisk!.length} students need attention
            </h2>
          </div>
          <div className="space-y-2">
            {atRisk!.slice(0, 5).map((student) => (
              <Link
                key={student.user_id}
                href={`/org/${slug}/students/${student.user_id}`}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:bg-red-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                      {student.name[0]}
                    </div>
                  )}
                  <span className="text-sm text-slate-700">{student.name}</span>
                </div>
                <span className="text-xs text-red-600 font-medium">
                  {student.reason_flags?.includes("no_activity")
                    ? "No activity in 7d"
                    : student.reason_flags?.includes("low_score")
                    ? "Low score"
                    : (student.reason_flags ?? []).join(", ") || "At risk"}
                </span>
              </Link>
            ))}
          </div>
          {atRisk!.length > 5 && (
            <Link
              href={`/org/${slug}/at-risk`}
              className="text-xs text-red-700 font-medium mt-2 block text-right hover:underline"
            >
              View all {atRisk!.length} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
