"use client";

import Link from "next/link";
import { Trash2, Layers, AlertTriangle, Loader2, CheckCircle2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SlideDeckSummary,
  useDeleteSlideDeck,
  getDeckPptxUrl,
} from "@/lib/hooks/use-slides";
import toast from "react-hot-toast";

export function DeckCard({
  groupId,
  deck,
  canDelete,
}: {
  groupId: string;
  deck: SlideDeckSummary;
  canDelete: boolean;
}) {
  const del = useDeleteSlideDeck(groupId);
  const pct = Math.min(100, Math.max(0, deck.my_progress_pct));
  const isReady = deck.status === "ready";
  const isError = deck.status === "error";

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-accent hover:shadow-sm">
      <Link
        href={`/groups/${groupId}/slides/${deck.id}`}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {deck.course_name && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {deck.course_name}
              </p>
            )}
            <h3 className="font-medium text-primary group-hover:text-accent">{deck.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Layers size={12} /> {deck.slide_count} slides
              </span>
              <StatusPill status={deck.status} />
              {isReady && deck.my_completed_slides > 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={12} /> {deck.my_completed_slides}/{deck.slide_count} done
                </span>
              )}
            </div>
            {isReady && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct === 100 ? "bg-emerald-500" : "bg-accent"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {isError && deck.error_message && (
              <p className="mt-2 text-xs text-red-600 line-clamp-2">{deck.error_message}</p>
            )}
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {isReady && (
          <a
            href={deck.pptx_url ?? getDeckPptxUrl(groupId, deck.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-accent"
            title="Download PPTX"
          >
            <Download size={14} />
          </a>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (!confirm(`Delete "${deck.title}"?`)) return;
              del.mutate(deck.id, {
                onSuccess: () => toast.success("Deleted"),
                onError: (err: unknown) =>
                  toast.error(err instanceof Error ? err.message : "Delete failed"),
              });
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SlideDeckSummary["status"] }) {
  if (status === "generating") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
        <Loader2 size={10} className="animate-spin" /> Generating
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
        <AlertTriangle size={10} /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
      <CheckCircle2 size={10} /> Ready
    </span>
  );
}
