"use client";

import { useParams } from "next/navigation";
import { Activity, Users, TrendingUp, AlertTriangle, BookOpen } from "lucide-react";
import { useOrgKpisOverview, useCohortsKpis, useAtRiskStudents } from "@/lib/hooks/use-org-kpis";

export default function OrgAnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: kpis, isLoading } = useOrgKpisOverview(slug);
  const { data: cohorts, isLoading: cohortsLoading } = useCohortsKpis(slug);
  const { data: atRisk } = useAtRiskStudents(slug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Engagement and performance metrics for your organisation.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Active today" value={isLoading ? null : kpis?.dau ?? 0} color="text-accent" />
        <KpiCard icon={Users} label="Active this week" value={isLoading ? null : kpis?.wau ?? 0} color="text-teal-500" />
        <KpiCard
          icon={TrendingUp}
          label="Avg exam score"
          value={isLoading ? null : kpis?.avg_exam_score != null ? `${Math.round(kpis.avg_exam_score)}%` : "—"}
          color="text-amber-500"
        />
        <KpiCard
          icon={AlertTriangle}
          label="At-risk students"
          value={isLoading ? null : kpis?.at_risk_count ?? 0}
          color="text-destructive"
        />
      </div>

      <section>
        <h2 className="font-sora text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-accent" />
          Cohort breakdown
        </h2>
        {cohortsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (cohorts ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
            No cohort data yet.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {(cohorts ?? []).map((c) => (
              <div key={c.cohort_id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-primary">{c.name}</p>
                <div className="flex items-center gap-6 text-xs text-slate-500">
                  <span><b className="text-primary">{c.dau}</b> active today</span>
                  <span>
                    avg score:{" "}
                    <b className="text-primary">
                      {c.avg_exam_score != null ? `${Math.round(c.avg_exam_score)}%` : "—"}
                    </b>
                  </span>
                  <span className={c.at_risk_count > 0 ? "text-destructive font-medium" : ""}>
                    {c.at_risk_count} at-risk
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(atRisk ?? []).length > 0 && (
        <section>
          <h2 className="font-sora text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive" />
            At-risk students
          </h2>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {(atRisk ?? []).slice(0, 10).map((s) => (
              <div key={s.user_id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {s.avatar_url ? (
                    <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-primary">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.email}</p>
                  </div>
                </div>
                <span className="text-xs text-destructive font-medium">
                  {(s.reason_flags ?? []).join(", ") || "at risk"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string | null;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-2 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold text-primary font-sora">
        {value === null ? <span className="text-slate-300 animate-pulse">—</span> : value}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
