"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Map,
  Target,
} from "lucide-react";
import { useLearningPath } from "@/lib/hooks/use-learning-paths";
import { cn } from "@/lib/utils";

export default function LearningPathDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; pathId: string }>;
}) {
  const { groupId, pathId } = use(params);
  const { data, isLoading, isError } = useLearningPath(groupId, pathId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Could not load learning path.
      </div>
    );
  }

  // Sequential unlock: a module is unlocked if all earlier ones are completed
  // OR if it's the first incomplete one.
  const firstIncomplete = data.modules.findIndex((m) => !m.completed);
  function isUnlocked(idx: number): boolean {
    if (idx === 0) return true;
    if (firstIncomplete === -1) return true;
    return idx <= firstIncomplete;
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/groups/${groupId}/learning-paths`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary"
      >
        <ArrowLeft size={14} /> All paths
      </Link>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-accent">
          <Map size={11} />
          Learning path
        </div>
        <h1 className="font-sora text-2xl font-bold text-primary">{data.title}</h1>
        {data.summary && <p className="mt-2 text-sm text-slate-600">{data.summary}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Map size={12} /> {data.module_count} modules
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> ~{data.estimated_minutes} min total
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <CheckCircle2 size={12} /> {data.completed_modules}/{data.module_count} complete
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                data.progress_pct === 100 ? "bg-emerald-500" : "bg-accent"
              )}
              style={{ width: `${data.progress_pct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-primary">{data.progress_pct}%</span>
        </div>
      </div>

      <div className="space-y-2">
        {data.modules.map((m, idx) => {
          const unlocked = isUnlocked(idx);
          return (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border bg-white transition-all",
                m.completed
                  ? "border-emerald-200"
                  : unlocked
                  ? "border-slate-200 hover:border-accent"
                  : "border-slate-100 opacity-60"
              )}
            >
              {unlocked ? (
                <Link
                  href={`/groups/${groupId}/learning-paths/${pathId}/modules/${m.id}`}
                  className="flex items-start gap-4 p-5"
                >
                  <ModuleIcon completed={m.completed} unlocked={unlocked} index={idx} />
                  <ModuleBody module={m} />
                </Link>
              ) : (
                <div className="flex cursor-not-allowed items-start gap-4 p-5">
                  <ModuleIcon completed={m.completed} unlocked={unlocked} index={idx} />
                  <ModuleBody module={m} locked />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleIcon({
  completed,
  unlocked,
  index,
}: {
  completed: boolean;
  unlocked: boolean;
  index: number;
}) {
  if (completed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 size={18} />
      </div>
    );
  }
  if (!unlocked) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Lock size={14} />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
      <span className="text-sm font-bold">{index + 1}</span>
    </div>
  );
}

function ModuleBody({
  module,
  locked,
}: {
  module: {
    title: string;
    objectives: string[];
    key_concepts: string[];
    estimated_minutes: number;
    completed: boolean;
  };
  locked?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-primary">{module.title}</h3>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <Clock size={12} /> {module.estimated_minutes} min
        </span>
      </div>
      {module.objectives.length > 0 && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
          <Target size={11} className="mr-1 inline" />
          {module.objectives.slice(0, 2).join(" · ")}
        </p>
      )}
      {module.key_concepts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {module.key_concepts.slice(0, 5).map((c) => (
            <span
              key={c}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {locked && (
        <p className="mt-2 text-[11px] text-slate-400">
          Complete the previous module to unlock.
        </p>
      )}
    </div>
  );
}
