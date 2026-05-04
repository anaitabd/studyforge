"use client";

import Link from "next/link";
import { BookOpen, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { FlashcardSet } from "@/lib/hooks/useApi";

export function FlashcardSetCard({ set, groupId }: { set: FlashcardSet; groupId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => apiDelete(`/api/v1/groups/${groupId}/flashcards/${set.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flashcards", groupId] }); toast.success("Set deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Link
      href={`/groups/${groupId}/flashcards/${set.id}`}
      className="group relative block rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${set.title}"?`)) del.mutate(); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-destructive transition-all"
        aria-label="Delete"
      >
        <Trash2 size={13} />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-amber/10 text-amber flex items-center justify-center"><BookOpen size={18} /></span>
        <div className="flex-1 min-w-0">
          <h3 className="font-sora font-semibold text-primary truncate pr-8">{set.title}</h3>
          <p className="text-[11px] text-slate-400">
            {set.card_count} cards · {formatDistanceToNow(new Date(set.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {set.due_count > 0 ? (
        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber/10 text-amber")}>
          🔁 {set.due_count} due today
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-teal/10 text-teal">
          ✓ Up to date
        </div>
      )}
    </Link>
  );
}
