"use client";

import { useState } from "react";
import { Target, Plus, CheckCircle2, XCircle, Clock, Flame } from "lucide-react";
import { useGoals, useCreateGoal, useUpdateGoal, useStreak, useWeakAreas } from "@/lib/hooks/use-individual-kpis";
import type { StudyGoal } from "@/lib/hooks/use-individual-kpis";
import { cn } from "@/lib/utils";

const SUBJECTS = [
  "Maths", "Français", "Arabe", "Sciences", "Physique", "Histoire-Géo",
  "Informatique", "Anglais", "Éducation Islamique",
] as const;

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
      subject: subject || undefined,
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
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary flex items-center gap-2">
            <Target size={22} className="text-accent" /> Study Goals
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Set targets, track progress, and build consistent habits.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition"
        >
          <Plus size={16} /> New goal
        </button>
      </div>

      {/* Streak banner */}
      {streak && streak.current > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <Flame size={22} className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {streak.current}-day streak
              {streak.today_active ? " — great work today!" : " — study today to keep it!"}
            </p>
            <p className="text-xs text-amber-600">Longest streak: {streak.longest} days</p>
          </div>
        </div>
      )}

      {/* Weak areas */}
      {(weakAreas ?? []).length > 0 && (
        <section>
          <h2 className="font-sora text-base font-semibold text-primary mb-2">Areas to improve</h2>
          <div className="flex flex-wrap gap-2">
            {(weakAreas ?? []).map((w) => (
              <span
                key={w}
                className="text-xs bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-full"
              >
                {w}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <h3 className="font-sora font-semibold text-primary">Create goal</h3>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="Goal title, e.g. Score 14/20 on Maths exam"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Subject (optional)</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <div className="relative">
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Target score"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                /20
              </span>
            </div>
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
            {[0, 1].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Target size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">
              No active goals. Create one to start tracking your progress.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} onUpdate={updateGoal.mutate} />
            ))}
          </div>
        )}
      </section>

      {/* Past goals */}
      {done.length > 0 && (
        <section>
          <h2 className="font-sora text-lg font-semibold text-slate-400 mb-3">Past goals</h2>
          <div className="space-y-3">
            {done.map((g) => (
              <GoalCard key={g.id} goal={g} onUpdate={updateGoal.mutate} />
            ))}
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
  const isActive = goal.status === "active";
  const daysLeft = goal.target_date
    ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000)
    : null;

  const cardClass = cn(
    "rounded-xl border p-4",
    goal.status === "achieved"
      ? "bg-emerald-50 border-emerald-200"
      : daysLeft !== null && daysLeft < 7
      ? "bg-amber-50 border-amber-200"
      : "bg-white border-slate-200"
  );

  const badgeClass = cn(
    "text-xs font-medium px-2 py-1 rounded-full",
    daysLeft === null
      ? "bg-slate-100 text-slate-600"
      : daysLeft < 0
      ? "bg-red-100 text-red-700"
      : daysLeft < 7
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600"
  );

  const badgeLabel =
    daysLeft === null
      ? goal.status === "achieved" ? "Achieved" : goal.status === "abandoned" ? "Abandoned" : "Active"
      : daysLeft < 0
      ? "Overdue"
      : daysLeft === 0
      ? "Due today"
      : `${daysLeft}d left`;

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 leading-snug">{goal.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {goal.subject && `${goal.subject} · `}
            {goal.target_score != null && `Target: ${goal.target_score}/20`}
          </p>
        </div>
        <span className={badgeClass}>{badgeLabel}</span>
      </div>

      {goal.target_date && (
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {goal.target_date
                ? new Date(goal.target_date).toLocaleDateString("fr-MA", {
                    year: "numeric", month: "short", day: "numeric",
                  })
                : ""}
            </span>
            {daysLeft !== null && daysLeft >= 0 && goal.target_score != null && (
              <span className="font-medium">Goal: {goal.target_score}/20</span>
            )}
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                goal.status === "achieved" ? "bg-emerald-500" : "bg-indigo-500"
              )}
              style={{ width: goal.status === "achieved" ? "100%" : "0%" }}
            />
          </div>
        </div>
      )}

      {isActive && (
        <div className="flex gap-1 pt-1">
          <button
            onClick={() => onUpdate({ id: goal.id, status: "achieved" })}
            title="Mark achieved"
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
          >
            <CheckCircle2 size={13} /> Achieved
          </button>
          <button
            onClick={() => onUpdate({ id: goal.id, status: "abandoned" })}
            title="Abandon"
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
          >
            <XCircle size={13} /> Abandon
          </button>
        </div>
      )}

      {!isActive && goal.status === "achieved" && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 pt-1">
          <CheckCircle2 size={12} /> Goal achieved
        </p>
      )}
    </div>
  );
}
