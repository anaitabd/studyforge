"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Clock, Brain, FileText, Target, CheckCircle, BarChart2,
  Plus, ArrowRight, type LucideIcon,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useGroups } from "@/lib/hooks/useApi";
import { GroupCard } from "@/components/groups/group-card";
import { useContinueLearning, type ContinueLearningItem } from "@/lib/hooks/use-continue-learning";
import { usePersonalKpis, useStreak } from "@/lib/hooks/use-individual-kpis";
import type { PersonalKpis, StreakData, ExamScoreTrendPoint } from "@/lib/hooks/use-individual-kpis";
import { XPBar } from "@/components/gamification/XPBar";
import { DailyChallengeWidget } from "@/components/gamification/DailyChallengeWidget";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useUser();
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: continueItems, isLoading: continueLoading } = useContinueLearning();
  const { data: kpis } = usePersonalKpis();
  const { data: streak } = useStreak();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const recent = (groups ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-sora text-3xl font-bold text-primary">
            {greeting}, {user?.firstName ?? "there"}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Pick up where you left off, or start something new.</p>
        </div>
        <div className="w-full sm:w-64">
          <XPBar />
        </div>
      </div>

      {/* Daily challenge */}
      <DailyChallengeWidget />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── Left column ── */}
        <div className="space-y-4">
          <StreakWidget streak={streak} />

          {/* KPI stat cards 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Active today"
              value={kpis ? `${kpis.active_minutes_today}m` : "—"}
              target={kpis ? `/ ${kpis.active_minutes_goal}m goal` : undefined}
              progress={kpis ? kpis.active_minutes_today / Math.max(kpis.active_minutes_goal, 1) : undefined}
              icon={<Clock className="w-4 h-4" />}
              color="indigo"
            />
            <StatCard
              label="Retention rate"
              value={kpis?.flashcard_retention_rate != null
                ? `${Math.round(kpis.flashcard_retention_rate * 100)}%`
                : "—"}
              sublabel={kpis ? `${kpis.cards_due_today} cards due` : undefined}
              icon={<Brain className="w-4 h-4" />}
              color={kpis?.flashcard_retention_rate != null && kpis.flashcard_retention_rate >= 0.7 ? "emerald" : "amber"}
              alert={kpis?.cards_overdue ? `${kpis.cards_overdue} overdue` : undefined}
            />
            <StatCard
              label="Last exam"
              value={kpis?.exam_score_trend?.at(-1)?.score != null
                ? `${((kpis.exam_score_trend.at(-1)!.score as number) * 20).toFixed(1)}/20`
                : "—"}
              icon={<FileText className="w-4 h-4" />}
              color={(() => {
                const s = kpis?.exam_score_trend?.at(-1)?.score;
                if (s == null) return "indigo";
                const pct = s * 100;
                return pct >= 70 ? "emerald" : pct >= 50 ? "amber" : "red";
              })()}
            />
            <StatCard
              label="Goal"
              value={kpis?.study_goal?.title ?? "No goal set"}
              sublabel={kpis?.study_goal
                ? (kpis.study_goal.on_pace ? "✓ On pace" : "⚠ Behind pace")
                : "Set a goal"}
              icon={<Target className="w-4 h-4" />}
              color={kpis?.study_goal?.on_pace ? "emerald" : "amber"}
              linkHref="/goals"
            />
          </div>

          <GoalProgressCard goal={kpis?.study_goal ?? null} />
          <ExamTrendChart trend={kpis?.exam_score_trend} />
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          {/* Continue learning */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock size={14} className="text-accent" /> Continue learning
              </h2>
            </div>
            {continueLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-200 animate-pulse" />)}
              </div>
            ) : (continueItems ?? []).length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-slate-500 text-xs">
                  No paths in progress. Open a group and generate a learning path.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(continueItems ?? []).slice(0, 4).map((it) => (
                  <ContinueCard key={it.path_id} item={it} />
                ))}
                {(continueItems ?? []).length > 4 && (
                  <Link
                    href="/groups"
                    className="block text-center text-xs text-accent hover:underline pt-1"
                  >
                    View all →
                  </Link>
                )}
              </div>
            )}
          </div>

          <WeakAreasWidget weakAreas={kpis?.weak_areas} />
        </div>
      </div>

      {/* ── Groups — full width ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sora text-xl font-semibold text-primary">Recent groups</h2>
          <Link href="/groups" className="text-sm text-accent hover:underline font-medium">
            View all →
          </Link>
        </div>
        {groupsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">No groups yet — create one to get started.</p>
            <Link
              href="/groups"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              <Plus size={15} /> Create your first group
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Streak widget ────────────────────────────────────────────────────────────

function StreakWidget({ streak }: { streak: StreakData | undefined }) {
  if (!streak) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-20" />
    );
  }
  const flames = Math.min(streak.current, 7);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className="relative shrink-0">
        <div className="text-4xl">🔥</div>
        {streak.today_active && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-900">{streak.current} days</div>
        <div className="text-xs text-slate-500">
          {streak.today_active ? "✓ Studied today" : "Study today to keep your streak!"}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">Longest: {streak.longest} days</div>
      </div>
      <div className="ml-auto flex gap-1 shrink-0">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={cn("w-2 h-6 rounded-full", i < flames ? "bg-orange-400" : "bg-slate-100")}
          />
        ))}
      </div>
    </div>
  );
}

// ─── KPI stat card ────────────────────────────────────────────────────────────

const COLOR_MAP = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", bar: "bg-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
  red: { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" },
} as const;

function StatCard({
  label, value, sublabel, target, progress, icon, color, alert, linkHref,
}: {
  label: string;
  value: string;
  sublabel?: string;
  target?: string;
  progress?: number;
  icon: React.ReactNode;
  color: keyof typeof COLOR_MAP;
  alert?: string;
  linkHref?: string;
}) {
  const c = COLOR_MAP[color];
  const inner = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow space-y-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>
          <div className={c.text}>{icon}</div>
        </div>
      </div>
      <div className="text-xl font-bold text-slate-900 leading-tight truncate">{value}</div>
      {target && <div className="text-xs text-slate-500">{target}</div>}
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", c.bar)}
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      )}
      {sublabel && <div className="text-xs text-slate-500">{sublabel}</div>}
      {alert && (
        <div className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
          ⚠ {alert}
        </div>
      )}
    </div>
  );
  return linkHref ? <Link href={linkHref} className="block">{inner}</Link> : inner;
}

// ─── Goal progress card ───────────────────────────────────────────────────────

function GoalProgressCard({ goal }: { goal: PersonalKpis["study_goal"] }) {
  if (!goal) {
    return (
      <Link
        href="/goals"
        className="flex items-center justify-between bg-white rounded-xl border border-dashed border-slate-200 p-4 hover:border-accent hover:bg-accent/5 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-accent/10 group-hover:text-accent">
            <Target size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">No study goal set</p>
            <p className="text-xs text-slate-400">Set a target to stay on track</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-400 group-hover:text-accent" />
      </Link>
    );
  }

  return (
    <Link
      href="/goals"
      className={cn(
        "block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow",
        goal.on_pace ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-0.5">Current goal</p>
          <p className="text-sm font-semibold text-slate-800 leading-snug truncate">{goal.title}</p>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-1 rounded-full shrink-0",
            goal.on_pace ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          )}
        >
          {goal.on_pace ? "✓ On pace" : "⚠ Behind"}
        </span>
      </div>
      {goal.days_remaining != null && (
        <p className="text-xs text-slate-500">
          {goal.days_remaining > 0
            ? `${goal.days_remaining} days remaining`
            : goal.days_remaining === 0
            ? "Due today"
            : "Overdue"}
          {goal.target_score != null && ` · Target: ${goal.target_score}/20`}
        </p>
      )}
    </Link>
  );
}

// ─── Exam trend chart ─────────────────────────────────────────────────────────

function ExamTrendChart({ trend }: { trend: ExamScoreTrendPoint[] | undefined }) {
  const validPoints = (trend ?? []).filter((t) => t.score !== null);

  if (validPoints.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Exam score trend</h3>
        <div className="flex flex-col items-center py-8 text-center">
          <BarChart2 className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Complete an exam to see your trend</p>
        </div>
      </div>
    );
  }

  const data = validPoints.map((t) => ({
    date: new Date(t.date).toLocaleDateString("fr-MA", { month: "short", day: "numeric" }),
    score: parseFloat(((t.score as number) * 20).toFixed(1)),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Exam score trend</h3>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
          <ReferenceLine
            y={10}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "Pass", fontSize: 9, fill: "#ef4444" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: "#6366f1", r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Tooltip formatter={(v) => [`${v}/20`, "Score"]} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Weak areas widget ────────────────────────────────────────────────────────

function WeakAreasWidget({ weakAreas }: { weakAreas: string[] | undefined }) {
  if (weakAreas === undefined) {
    return <div className="bg-white rounded-xl border border-slate-200 p-4 h-32 animate-pulse" />;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Areas to review</h3>
        <span className="text-xs text-slate-400">Identified by AI</span>
      </div>
      {weakAreas.length === 0 ? (
        <p className="text-sm text-emerald-600 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> No weak areas — great work!
        </p>
      ) : (
        <ul className="space-y-2">
          {weakAreas.map((area, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-slate-600">{area}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Continue card ────────────────────────────────────────────────────────────

function ContinueCard({ item }: { item: ContinueLearningItem }) {
  const href = item.next_module_id
    ? `/groups/${item.group_id}/learning-paths/${item.path_id}/modules/${item.next_module_id}`
    : `/groups/${item.group_id}/learning-paths/${item.path_id}`;
  const pct = Math.min(100, Math.max(0, item.progress_pct));
  const completed = item.completed_modules >= item.module_count && item.module_count > 0;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-accent hover:shadow-sm transition"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
          {item.group_name}
        </p>
        <h3 className="font-sora font-semibold text-primary text-xs leading-snug line-clamp-1">
          {item.title}
        </h3>
        <div className="mt-1.5">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full", completed ? "bg-teal" : "bg-accent")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {item.completed_modules}/{item.module_count} · {pct}%
          </p>
        </div>
      </div>
      <ArrowRight size={14} className="text-slate-400 group-hover:text-accent shrink-0" />
    </Link>
  );
}
