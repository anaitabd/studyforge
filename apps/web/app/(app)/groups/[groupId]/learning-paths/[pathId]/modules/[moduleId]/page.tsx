"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Target,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useLearningPath,
  useLearningPathModule,
  useToggleModule,
} from "@/lib/hooks/use-learning-paths";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function ModuleReaderPage({
  params,
}: {
  params: Promise<{ groupId: string; pathId: string; moduleId: string }>;
}) {
  const { groupId, pathId, moduleId } = use(params);
  const router = useRouter();
  const { data: path } = useLearningPath(groupId, pathId);
  const { data: module, isLoading } = useLearningPathModule(groupId, pathId, moduleId);
  const toggle = useToggleModule(groupId, pathId);

  const navigation = useMemo(() => {
    if (!path) return { prev: null, next: null, idx: -1 };
    const idx = path.modules.findIndex((m) => m.id === moduleId);
    return {
      idx,
      prev: idx > 0 ? path.modules[idx - 1] : null,
      next: idx >= 0 && idx < path.modules.length - 1 ? path.modules[idx + 1] : null,
    };
  }, [path, moduleId]);

  if (isLoading || !module) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  function handleComplete(next?: { id: string }) {
    toggle.mutate(
      { moduleId, completed: !module!.completed },
      {
        onSuccess: () => {
          if (!module!.completed) {
            toast.success("Module complete!");
            if (next) {
              router.push(`/groups/${groupId}/learning-paths/${pathId}/modules/${next.id}`);
            } else {
              router.push(`/groups/${groupId}/learning-paths/${pathId}`);
            }
          } else {
            toast.success("Marked incomplete");
          }
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Could not update"),
      }
    );
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/groups/${groupId}/learning-paths/${pathId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary"
      >
        <ArrowLeft size={14} /> Back to path
      </Link>

      {path && navigation.idx >= 0 && (
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">
          Module {navigation.idx + 1} of {path.module_count} · {path.title}
        </p>
      )}

      <h1 className="font-sora text-3xl font-bold text-primary">{module.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Clock size={12} /> {module.estimated_minutes} min read
        </span>
        {module.source_pages.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <FileText size={12} /> Pages {module.source_pages.slice(0, 6).join(", ")}
          </span>
        )}
      </div>

      {module.objectives.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <Target size={12} />
            Learning objectives
          </p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {module.objectives.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <Circle size={6} className="mt-2 shrink-0 fill-accent text-accent" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="prose prose-slate mt-6 max-w-none prose-headings:font-sora prose-headings:text-primary prose-p:text-slate-700 prose-a:text-accent">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{module.content_markdown ?? ""}</ReactMarkdown>
      </article>

      {module.key_concepts.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Key concepts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {module.key_concepts.map((c) => (
              <span
                key={c}
                className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
        <div>
          {navigation.prev && (
            <Link
              href={`/groups/${groupId}/learning-paths/${pathId}/modules/${navigation.prev.id}`}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft size={14} />
              Previous
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleComplete(navigation.next ?? undefined)}
            disabled={toggle.isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              module.completed
                ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            <CheckCircle2 size={14} />
            {module.completed ? "Mark incomplete" : "Mark complete & continue"}
          </button>
          {navigation.next && module.completed && (
            <Link
              href={`/groups/${groupId}/learning-paths/${pathId}/modules/${navigation.next.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Next
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
