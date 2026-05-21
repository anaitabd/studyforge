"use client";

import { use, useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import { useFlashcardSets } from "@/lib/hooks/use-flashcards";
import { FlashcardSetCard } from "@/components/flashcards/flashcard-set-card";
import { GenerateFlashcardsDialog } from "@/components/flashcards/generate-flashcards-dialog";

export default function FlashcardsListPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: sets, isLoading } = useFlashcardSets(groupId);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{sets?.length ?? 0} set{(sets?.length ?? 0) !== 1 ? "s" : ""}</p>
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
          <Plus size={15} /> Generate set
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1].map((i) => <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (sets?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <BookOpen className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-slate-500 text-sm mb-4">No flashcard sets yet.</p>
          <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent hover:underline font-medium">Generate your first set →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets!.map((s) => <FlashcardSetCard key={s.id} set={s} groupId={groupId} />)}
        </div>
      )}

      <GenerateFlashcardsDialog groupId={groupId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
