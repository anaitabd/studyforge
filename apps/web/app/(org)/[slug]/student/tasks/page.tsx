"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMyAssignments, type Assignment } from "@/lib/hooks/use-org-admin";
import { ScoreOver20 } from "@/components/org/score-over-20";

const STATUS_CHIP: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-emerald-100 text-emerald-700",
  graded: "bg-indigo-100 text-indigo-700",
};

function daysLeft(dueAt: string | null): number | null {
  if (!dueAt) return null;
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}

function TaskCard({ assignment, slug }: { assignment: Assignment; slug: string }) {
  const days = daysLeft(assignment.due_at);
  const isOverdue = days !== null && days < 0;
  const isSoon = days !== null && days >= 0 && days < 3;
  const isDone =
    assignment.progress?.status === "submitted" ||
    assignment.progress?.status === "graded";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isOverdue
          ? "bg-red-50 border-red-200"
          : isSoon
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                assignment.resource_type === "exam"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {assignment.resource_type === "exam" ? "Exam" : "Learning path"}
            </span>
            {assignment.progress?.status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  STATUS_CHIP[assignment.progress.status] ?? ""
                }`}
              >
                {assignment.progress.status.replace("_", " ")}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-800 truncate">{assignment.title}</h3>
          {assignment.instructions && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {assignment.instructions}
            </p>
          )}
        </div>
        {days !== null && (
          <span
            className={`flex-shrink-0 text-xs font-medium ${
              isOverdue ? "text-red-700" : isSoon ? "text-amber-700" : "text-slate-500"
            }`}
          >
            {isOverdue
              ? `${Math.abs(days)}d overdue`
              : days === 0
              ? "Due today"
              : `${days}d left`}
          </span>
        )}
      </div>

      {!isDone && (
        <Link
          href={`/groups/${assignment.group_id}/${assignment.resource_type === "exam" ? "exams" : "learning-paths"}/${assignment.resource_id}`}
          className="block w-full bg-indigo-600 text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {assignment.progress?.status === "in_progress" ? "Continue" : "Start"}
        </Link>
      )}

      {assignment.progress?.score_over_20 != null && (
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-500">Your score</span>
          <ScoreOver20 score={assignment.progress.score_over_20} size="sm" />
        </div>
      )}
    </div>
  );
}

type Group = "overdue" | "soon" | "upcoming" | "done";

function groupAssignment(a: Assignment): Group {
  const status = a.progress?.status;
  if (status === "submitted" || status === "graded") return "done";
  const days = daysLeft(a.due_at);
  if (days !== null && days < 0) return "overdue";
  if (days !== null && days < 3) return "soon";
  return "upcoming";
}

const GROUP_CONFIG: Record<Group, { label: string; emptyLabel: string }> = {
  overdue: { label: "Overdue", emptyLabel: "" },
  soon: { label: "Due soon", emptyLabel: "" },
  upcoming: { label: "Upcoming", emptyLabel: "No upcoming tasks." },
  done: { label: "Completed", emptyLabel: "" },
};

export default function StudentTasksPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: assignments, isLoading } = useMyAssignments(slug);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-32 bg-slate-100 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!assignments?.length) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400 text-sm">No assignments yet. Check back soon.</p>
      </div>
    );
  }

  const grouped: Record<Group, Assignment[]> = {
    overdue: [],
    soon: [],
    upcoming: [],
    done: [],
  };
  for (const a of assignments) {
    grouped[groupAssignment(a)].push(a);
  }

  const ORDER: Group[] = ["overdue", "soon", "upcoming", "done"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">My tasks</h1>
        <p className="text-slate-500 text-sm mt-1">Assignments from your teacher.</p>
      </div>

      {ORDER.map((group) => {
        const items = grouped[group];
        if (!items.length && group !== "upcoming") return null;
        return (
          <section key={group}>
            <h2
              className={`text-sm font-semibold mb-3 ${
                group === "overdue"
                  ? "text-red-700"
                  : group === "soon"
                  ? "text-amber-700"
                  : "text-slate-700"
              }`}
            >
              {GROUP_CONFIG[group].label}
              {items.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({items.length})
                </span>
              )}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">{GROUP_CONFIG[group].emptyLabel}</p>
            ) : (
              <div className="space-y-3">
                {items.map((a) => (
                  <TaskCard key={a.id} assignment={a} slug={slug} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
