"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, BookOpen, Users, Calendar } from "lucide-react";
import { useCohorts, useCreateCohort } from "@/lib/hooks/use-cohorts";

export default function CohortsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: cohorts, isLoading } = useCohorts(slug);
  const createCohort = useCreateCohort(slug);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createCohort.mutateAsync({ name: name.trim(), subject: subject.trim() || undefined });
    setName("");
    setSubject("");
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Cohorts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage student groups and their assignments.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition"
        >
          <Plus size={16} /> New cohort
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-sora font-semibold text-primary">Create cohort</h3>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Cohort name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createCohort.isPending}
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition disabled:opacity-50"
            >
              {createCohort.isPending ? "Creating…" : "Create"}
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

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (cohorts ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
          <BookOpen size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No cohorts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(cohorts ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/org/${slug}/cohorts/${c.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <BookOpen size={18} />
                </div>
                {c.is_archived && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Archived</span>
                )}
              </div>
              <h3 className="font-sora font-semibold text-primary group-hover:text-accent transition">{c.name}</h3>
              {c.subject && <p className="text-xs text-slate-400 mt-0.5">{c.subject}</p>}
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {c.member_count} members
                </span>
                {c.end_date && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> ends {new Date(c.end_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
