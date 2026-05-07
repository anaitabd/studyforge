"use client";

import { use, useState } from "react";
import { Plus, Presentation } from "lucide-react";
import { useSlideDecks } from "@/lib/hooks/use-slides";
import { useGroups } from "@/lib/hooks/useApi";
import { useUser } from "@clerk/nextjs";
import { DeckCard } from "@/components/slides/deck-card";
import { GenerateDeckDialog } from "@/components/slides/generate-deck-dialog";

export default function SlidesPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data: decks, isLoading } = useSlideDecks(groupId);
  const { data: groups } = useGroups();
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  const group = groups?.find((g) => g.id === groupId);
  const myRole = group?.my_role ?? "student";
  const canCreate = myRole === "owner" || myRole === "teacher";
  const canDelete = canCreate;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Course slides</h1>
          <p className="text-sm text-slate-500">
            Browsable lecture decks generated from this group&apos;s files — with
            deep explanations, examples, and per-slide quizzes.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus size={14} />
            Generate slides
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {!isLoading && (decks?.length ?? 0) === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Presentation className="mx-auto mb-3 text-slate-300" size={36} />
          <p className="font-medium text-slate-700">No slide decks yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canCreate
              ? "Generate a slide deck from the group's files to get a guided lecture with quizzes."
              : "Ask a teacher to generate slides for this group."}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus size={14} />
              Create your first deck
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(decks ?? []).map((d) => (
          <DeckCard key={d.id} groupId={groupId} deck={d} canDelete={canDelete} />
        ))}
      </div>

      {canCreate && (
        <GenerateDeckDialog groupId={groupId} open={open} onClose={() => setOpen(false)} />
      )}

      {!user && null /* keep useUser import wired */}
    </div>
  );
}
