"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  front: string;
  back: string;
  sourcePassage?: string | null;
  onFlip?: () => void;
}

export function FlipCard({ front, back, sourcePassage, onFlip }: Props) {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    setFlipped((v) => {
      if (!v) onFlip?.();
      return !v;
    });
  }

  return (
    <div className="w-full" style={{ perspective: "1200px" }}>
      <div
        onClick={handleFlip}
        className="relative cursor-pointer transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          height: 280,
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center p-8 text-center"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">Question</p>
          <p className="text-lg font-medium text-slate-900 leading-relaxed">{front}</p>
          <p className="text-xs text-slate-400 mt-6">Click to reveal answer</p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl border border-primary/30 bg-primary/5 shadow-sm flex flex-col items-center justify-center p-8 text-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-xs uppercase tracking-widest text-primary/60 mb-4">Answer</p>
          <p className="text-lg font-medium text-slate-900 leading-relaxed">{back}</p>
          {sourcePassage && (
            <p className="text-xs text-slate-400 mt-4 italic line-clamp-2">{sourcePassage}</p>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setFlipped(false);
        }}
        className={cn(
          "mt-3 flex items-center gap-1.5 mx-auto text-xs text-slate-400 hover:text-slate-600 transition-colors",
          !flipped && "opacity-0 pointer-events-none"
        )}
      >
        <RotateCcw size={12} />
        Flip back
      </button>
    </div>
  );
}
