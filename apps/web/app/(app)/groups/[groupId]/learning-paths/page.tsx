"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Plus, Map, Clock, CheckCircle2, Trash2 } from "lucide-react";
import {
  useLearningPaths,
  useDeleteLearningPath,
} from "@/lib/hooks/use-learning-paths";
import { GeneratePathDialog } from "@/components/learning-paths/generate-path-dialog";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function LearningPathsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data: paths, isLoading } = useLearningPaths(groupId);
  const del = useDeleteLearningPath(groupId);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Learning paths</h1>
          <p className="text-sm text-slate-500">
            Structured study journeys generated from this group's files.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={14} />
          New path
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {!isLoading && (paths?.length ?? 0) === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Map className="mx-auto mb-3 text-slate-300" size={36} />
          <p className="font-medium text-slate-700">No learning paths yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Generate one from your uploaded files to get a guided study plan.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus size={14} />
            Create your first path
          </button>
        </div>
      )}

      <div className="space-y-3">
        {(paths ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/groups/${groupId}/learning-paths/${p.id}`}
            className="group relative block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-accent hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-primary group-hover:text-accent">{p.title}</h3>
                {p.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.summary}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Map size={12} /> {p.module_count} modules
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} /> {p.estimated_minutes} min
                  </span>
                  {p.completed_modules > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={12} /> {p.completed_modules}/{p.module_count} done
                    </span>
                  )}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      p.progress_pct === 100 ? "bg-emerald-500" : "bg-accent"
                    )}
                    style={{ width: `${p.progress_pct}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (!confirm(`Delete "${p.title}"?`)) return;
                  del.mutate(p.id, {
                    onSuccess: () => toast.success("Deleted"),
                    onError: (err: unknown) =>
                      toast.error(err instanceof Error ? err.message : "Delete failed"),
                  });
                }}
                className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Link>
        ))}
      </div>

      <GeneratePathDialog groupId={groupId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
