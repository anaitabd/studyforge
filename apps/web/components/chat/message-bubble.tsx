"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Pin, Sparkles, FileText, ChevronDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import { CitationCard } from "./citation-card";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hooks/useApi";

export function MessageBubble({ message, groupId, onSuggestionClick }: { message: ChatMessage; groupId: string; onSuggestionClick: (s: string) => void }) {
  const { user } = useUser();
  const qc = useQueryClient();
  const [showCites, setShowCites] = useState(false);
  const isUser = message.role === "user";

  const pin = useMutation({
    mutationFn: () => apiPost(`/api/v1/groups/${groupId}/chat/messages/${message.id}/pin`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pinned", groupId] }),
  });

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className="shrink-0">
        {isUser ? (
          user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">{user?.firstName?.[0] ?? "U"}</div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center"><Sparkles size={14} /></div>
        )}
      </div>

      <div className={cn("flex-1 min-w-0 max-w-[85%]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed group/bubble",
            isUser ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm",
          )}
        >
          {message.is_pinned && <Pin size={11} className="absolute top-2 right-2 text-amber" />}
          {!message.content ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}

          {!isUser && message.content && message.id && (
            <button
              type="button"
              onClick={() => pin.mutate()}
              className="absolute -top-2 -right-2 opacity-0 group-hover/bubble:opacity-100 p-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:text-amber"
              aria-label="Pin"
            >
              <Pin size={11} />
            </button>
          )}
        </div>

        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-2 w-full">
            <button
              type="button"
              onClick={() => setShowCites((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <FileText size={11} /> Sources ({message.citations.length})
              <ChevronDown size={11} className={cn("transition-transform", showCites && "rotate-180")} />
            </button>
            {showCites && (
              <div className="mt-2 space-y-1.5 animate-in">
                {message.citations.map((c, i) => <CitationCard key={`${c.file_id}-${c.chunk_index}`} citation={c} index={i} />)}
              </div>
            )}
          </div>
        )}

        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => onSuggestionClick(s)}
                className="px-3 py-1 rounded-full border border-accent/30 text-xs text-accent hover:bg-accent/5 hover:border-accent transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
