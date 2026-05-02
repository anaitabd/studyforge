"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { type Citation } from "@/lib/hooks/use-chat";

export function CitationCard({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 transition-colors text-left"
      >
        <FileText size={12} className="shrink-0 text-slate-400" />
        <span className="flex-1 truncate font-medium text-slate-700">
          [{index + 1}] {citation.file_name}
          {citation.page ? `, p. ${citation.page}` : ""}
        </span>
        <span className="text-slate-400 text-[10px] mr-1">
          {Math.round(citation.similarity_score * 100)}%
        </span>
        {expanded ? (
          <ChevronUp size={12} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-slate-400" />
        )}
      </button>
      {expanded && (
        <p className="px-3 py-2 text-slate-600 border-t border-slate-200 leading-relaxed">
          {citation.excerpt}
        </p>
      )}
    </div>
  );
}
