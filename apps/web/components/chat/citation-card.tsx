"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Citation { file_name: string; page: number; excerpt: string; file_id: string; chunk_index: number; similarity_score: number; }

export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border-l-4 border-accent bg-accent/5 overflow-hidden">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 text-left">
        <FileText size={12} className="shrink-0 text-accent" />
        <span className="flex-1 truncate text-xs font-medium text-primary">[{index + 1}] {citation.file_name}{citation.page ? `, p. ${citation.page}` : ""}</span>
        <span className="text-[10px] text-slate-400">{Math.round(citation.similarity_score * 100)}%</span>
        <ChevronDown size={12} className={cn("text-slate-400 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && <p className="px-3 py-2 text-xs italic text-slate-600 leading-relaxed bg-white border-t border-slate-100">{citation.excerpt}</p>}
    </div>
  );
}
