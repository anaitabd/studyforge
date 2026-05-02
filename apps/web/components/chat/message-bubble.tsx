"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationCard } from "./citation-card";
import { type ChatMessage } from "@/lib/hooks/use-chat";

interface Props {
  message: ChatMessage;
  onSuggestionClick: (text: string) => void;
}

export function MessageBubble({ message, onSuggestionClick }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
        )}
      >
        {message.content || (message.streaming && <Loader2 size={14} className="animate-spin" />)}
        {message.streaming && message.content && (
          <span className="inline-block w-1 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>

      {/* Citations */}
      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="max-w-[80%] w-full space-y-1.5">
          {message.citations.map((c, i) => (
            <CitationCard key={`${c.file_id}-${c.chunk_index}`} citation={c} index={i} />
          ))}
        </div>
      )}

      {/* Follow-up suggestion chips */}
      {!isUser && message.suggestions && message.suggestions.length > 0 && !message.streaming && (
        <div className="max-w-[80%] flex flex-wrap gap-2 mt-1">
          {message.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestionClick(s)}
              className="px-3 py-1.5 rounded-full border border-primary/30 text-primary text-xs hover:bg-primary/5 hover:border-primary transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
