"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Users, ClipboardList, Plus, ChevronRight, UserCircle } from "lucide-react";
import { useCohort, useCohortMembers } from "@/lib/hooks/use-cohorts";
import { useAssignments, useAssignmentProgress, useCreateAssignment } from "@/lib/hooks/use-assignments";
import { useCohortKpis } from "@/lib/hooks/use-org-kpis";

type Tab = "students" | "assignments";

export default function CohortDetailPage() {
  const { slug, cohortId } = useParams<{ slug: string; cohortId: string }>();
  const [tab, setTab] = useState<Tab>("students");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDue, setAssignDue] = useState("");

  const { data: cohort } = useCohort(slug, cohortId);
  const { data: members, isLoading: membersLoading } = useCohortMembers(slug, cohortId);
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments(slug, cohortId);
  const { data: kpis } = useCohortKpis(slug, cohortId);
  const createAssignment = useCreateAssignment(slug, cohortId);

  const students = (members ?? []).filter((m) => m.role === "student");

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTitle.trim()) return;
    await createAssignment.mutateAsync({
      title: assignTitle.trim(),
      resource_type: "exam",
      resource_id: "",
      due_at: assignDue || undefined,
    });
    setAssignTitle("");
    setAssignDue("");
    setShowAssignForm(false);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href={`/org/${slug}/cohorts`} className="hover:text-primary transition-colors">Cohorts</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-primary">{cohort?.name ?? "…"}</span>
      </div>

      {/* Header + KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">{cohort?.name}</h1>
          {cohort?.subject && <p className="text-slate-500 text-sm">{cohort.subject}</p>}
        </div>
        {kpis && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-primary">{kpis.dau}</div>
              <div className="text-slate-400 text-xs">active today</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-primary">
                {kpis.avg_exam_score != null ? `${Math.round(kpis.avg_exam_score)}%` : "—"}
              </div>
              <div className="text-slate-400 text-xs">avg score</div>
            </div>
            <div className="text-center">
              <div className={`font-bold ${kpis.at_risk_count > 0 ? "text-destructive" : "text-primary"}`}>
                {kpis.at_risk_count}
              </div>
              <div className="text-slate-400 text-xs">at-risk</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["students", "assignments"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-slate-500 hover:text-primary"
            }`}
          >
            {t === "students" ? <Users size={14} /> : <ClipboardList size={14} />}
            {t}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {tab === "students" && (
        <div>
          {membersLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-400">No students in this cohort yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {students.map((s) => (
                <Link
                  key={s.user_id}
                  href={`/org/${slug}/students/${s.user_id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <UserCircle size={18} className="text-accent" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-primary">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignments tab */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAssignForm(true)}
              className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition"
            >
              <Plus size={16} /> New assignment
            </button>
          </div>

          {showAssignForm && (
            <form onSubmit={handleCreateAssignment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="font-sora font-semibold text-primary">Create assignment</h3>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Title"
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                required
              />
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                value={assignDue}
                onChange={(e) => setAssignDue(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createAssignment.isPending}
                  className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition disabled:opacity-50"
                >
                  {createAssignment.isPending ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignForm(false)}
                  className="text-sm text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {assignmentsLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : (assignments ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No assignments yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {(assignments ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-primary">{a.title}</p>
                    {a.due_at && (
                      <p className="text-xs text-slate-400">
                        Due {new Date(a.due_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                    {a.resource_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
