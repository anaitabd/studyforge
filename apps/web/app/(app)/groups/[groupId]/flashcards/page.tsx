"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, BookOpen, Trash2, Loader2 } from "lucide-react";
import { useFlashcardSets, useGenerateSet, useDeleteSet } from "@/lib/hooks/use-flashcards";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function FlashcardsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: sets, isLoading } = useFlashcardSets(groupId);
  const { mutate: generateSet, isPending: generating } = useGenerateSet(groupId);
  const { mutate: deleteSet } = useDeleteSet(groupId);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    generateSet(
      { title: title.trim(), max_cards: 40, language: "auto" },
      {
        onSuccess: () => {
          toast.success("Flashcard set generated!");
          setTitle("");
          setShowForm(false);
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  }

  function handleDelete(setId: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteSet(setId, {
      onSuccess: () => toast.success("Set deleted"),
      onError: (err) => toast.error((err as Error).message),
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/groups/${groupId}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex-1">Flashcards</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={15} />
          Generate set
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleGenerate} className="flex gap-2 mb-6">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Set title, e.g. Chapter 4 Vocabulary"
            autoFocus
          />
          <button
            type="submit"
            disabled={generating || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {generating && <Loader2 size={13} className="animate-spin" />}
            {generating ? "Generating…" : "Generate"}
          </button>
        </form>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {sets && sets.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <BookOpen size={32} className="text-slate-300" />
          <p className="text-slate-500 text-sm">No flashcard sets yet.</p>
          <button onClick={() => setShowForm(true)} className="text-sm text-primary hover:underline">
            Generate your first set →
          </button>
        </div>
      )}

      {sets && sets.length > 0 && (
        <ul className="space-y-2">
          {sets.map((s) => (
            <li key={s.id} className="group relative">
              <Link
                href={`/groups/${groupId}/flashcards/${s.id}`}
                className="flex items-center gap-4 px-4 py-4 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <BookOpen size={18} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {s.card_count} cards · {formatRelative(s.created_at)}
                  </p>
                </div>
                {s.due_count > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {s.due_count} due
                  </span>
                )}
              </Link>
              <button
                onClick={() => handleDelete(s.id, s.title)}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg",
                  "opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                )}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
