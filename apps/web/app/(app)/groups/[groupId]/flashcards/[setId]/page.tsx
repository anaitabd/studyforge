"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useDueCards, useReviewCard } from "@/lib/hooks/use-flashcards";
import { FlipCard } from "@/components/flashcards/flip-card";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const RATINGS = [
  { key: "again", label: "Again", color: "border-red-300 text-red-600 hover:bg-red-50" },
  { key: "hard", label: "Hard", color: "border-amber-300 text-amber-600 hover:bg-amber-50" },
  { key: "good", label: "Good", color: "border-blue-300 text-blue-600 hover:bg-blue-50" },
  { key: "easy", label: "Easy", color: "border-emerald-300 text-emerald-600 hover:bg-emerald-50" },
] as const;

export default function StudySetPage({
  params,
}: {
  params: Promise<{ groupId: string; setId: string }>;
}) {
  const { groupId, setId } = use(params);
  const { data: cards, isLoading, refetch } = useDueCards(groupId, setId);
  const { mutate: review, isPending: reviewing } = useReviewCard(groupId, setId);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  const current = cards?.[index];

  const handleRate = useCallback(
    (rating: string) => {
      if (!current || !flipped) return;
      review(
        { cardId: current.id, rating },
        {
          onSuccess: () => {
            setSessionCount((c) => c + 1);
            setFlipped(false);
            if (cards && index + 1 < cards.length) {
              setIndex((i) => i + 1);
            } else {
              refetch();
              setIndex(0);
            }
          },
          onError: (err) => toast.error((err as Error).message),
        }
      );
    },
    [current, flipped, review, cards, index, refetch]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/groups/${groupId}/flashcards`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-slate-900">Study session</h1>
          {cards && (
            <p className="text-xs text-slate-400 mt-0.5">
              {cards.length} cards remaining · {sessionCount} reviewed this session
            </p>
          )}
        </div>
      </div>

      {cards && cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <CheckCircle2 size={40} className="text-emerald-400" />
          <p className="font-semibold text-slate-900">All caught up!</p>
          <p className="text-sm text-slate-500">No cards due right now. Come back later.</p>
          <Link
            href={`/groups/${groupId}/flashcards`}
            className="mt-2 text-sm text-primary hover:underline"
          >
            ← Back to sets
          </Link>
        </div>
      )}

      {current && (
        <>
          {/* Progress */}
          <div className="h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((index / (cards?.length ?? 1)) * 100)}%` }}
            />
          </div>

          <FlipCard
            key={current.id}
            front={current.front}
            back={current.back}
            sourcePassage={current.source_passage}
            onFlip={() => setFlipped(true)}
          />

          {/* Rating buttons — only appear after flipping */}
          <div
            className={cn(
              "grid grid-cols-4 gap-2 mt-6 transition-all duration-300",
              flipped ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {RATINGS.map(({ key, label, color }) => (
              <button
                type="button"
                key={key}
                onClick={() => handleRate(key)}
                disabled={reviewing || !flipped}
                className={cn(
                  "py-2.5 rounded-xl border text-sm font-medium transition-colors",
                  color
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-3">
            Rate how well you remembered the answer
          </p>
        </>
      )}
    </div>
  );
}
