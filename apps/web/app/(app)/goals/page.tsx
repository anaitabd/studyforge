"use client";

import { useState } from "react";
import { Target, Plus, CheckCircle2, XCircle, Clock, TrendingUp, Flame } from "lucide-react";
import { useGoals, useCreateGoal, useUpdateGoal, useStreak, useWeakAreas } from "@/lib/hooks/use-individual-kpis";
import type { StudyGoal } from "@/lib/hooks/use-individual-kpis";

const STATUS_CONFIG = {
  active: { label: "Active", icon: Clock, color: "text-accent bg-accent/10" },
  achieved: { label: "Achieved", icon: CheckCircle2, color: "text-green-600 bg-green-100" },
  abandoned: { label: "Abandoned", icon: XCircle, color: "text-slate-400 bg-slate-100" },
} as const;

export default function GoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const { data: streak } = useStreak();
  const { data: weakAreas } = useWeakAreas();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetScore, setTargetScore] = useState("");

  const active = (goals ?? []).filter((g) => g.status === "active");
  const done = (goals ?? []).filter((g) => g.status !== "active");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createGoal.mutateAsync({
      title: title.trim(),
      subject: subject.trim() || undefined,
      target_date: targetDate || undefined,
      target_score: targetScore ? Number(targetScore) : undefined,
    });
    setTitle("");
    setSubject("");
    setTargetDate("");
    setTargetScore("");
    setShowForm(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary flex items-center gap-2">
            <Target size={22} className="text-accent" /> Study Goals
          </h1>
          <p className="text-slate-500 text-sm mt-1">Set targets, track progress, and build consistent habits.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition"
        >
          <Plus size={16} /> New goal
        </button>
      </div>

      {/* Streak banner */}
      {streak && streak.current_streak > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <Flame size={22} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {streak.current_streak}-day streak{streak.has_activity_today ? " — great work today!" : " — study today to keep it!"}
            </p>
            <p className="text-xs text-amber-600">Longest streak: {streak.longest_streak} days</p>
          </div>
        </div>
      )}

      {/* Weak areas */}
      {(weakAreas ?? []).length > 0 && (
        <section>
          <h2 className="font-sora text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-destructive" /> Areas to improve
          </h2>
          <div className="flex flex-wrap gap-2">
            {(weakAreas ?? []).map((w) => (
              <span
                key={w.concept}
                className="text-xs bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-full"
              >
                {w.concept}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-sora font-semibold text-primary">Create goal</h3>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Goal title, e.g. Score 85% on biology exam"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Subject (optional)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <input
              type="number"
              min="0"
              max="100"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              placeholder="Target score %"
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createGoal.isPending}
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition disabled:opacity-50"
            >
              {createGoal.isPending ? "Saving…" : "Save goal"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active goals */}
      <section>
        <h2 className="font-sora text-lg font-semibold text-primary mb-3">Active goals</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Target size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No active goals. Create one to start tracking your progress.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((g) => <GoalCard key={g.id} goal={g} onUpdate={updateGoal.mutate} />)}
          </div>
        )}
      </section>

      {/* Past goals */}
      {done.length > 0 && (
        <section>
          <h2 className="font-sora text-lg font-semibold text-slate-400 mb-3">Past goals</h2>
          <div className="space-y-3">
            {done.map((g) => <GoalCard key={g.id} goal={g} onUpdate={updateGoal.mutate} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onUpdate,
}: {
  goal: StudyGoal;
  onUpdate: (params: { id: string; status: string }) => void;
}) {
  const cfg = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.active;
  const Icon = cfg.icon;
  const isActive = goal.status === "active";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sora font-semibold text-primary text-sm leading-snug">{goal.title}</p>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {goal.subject && (
            <span className="text-xs text-slate-400">{goal.subject}</span>
          )}
          {goal.target_score != null && (
            <span className="text-xs text-slate-500">target: <b>{goal.target_score}%</b></span>
          )}
          {goal.target_date && (
            <span className={`text-xs ${goal.days_remaining != null && goal.days_remaining < 3 && isActive ? "text-destructive font-medium" : "text-slate-400"}`}>
              {goal.days_remaining != null
                ? goal.days_remaining > 0
                  ? `${goal.days_remaining}d left`
                  : "overdue"
                : new Date(goal.target_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {isActive && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => onUpdate({ id: goal.id, status: "achieved" })}
            title="Mark achieved"
            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition"
          >
            <CheckCircle2 size={15} />
          </button>
          <button
            onClick={() => onUpdate({ id: goal.id, status: "abandoned" })}
            title="Abandon"
            className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition"
          >
            <XCircle size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
