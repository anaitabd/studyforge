"use client";

import { use, useEffect, useRef, useCallback } from "react";
import { useStreamingChat } from "@/lib/hooks/use-streaming-chat";
import { useChatHistory, useGroupFiles } from "@/lib/hooks/useApi";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput, type ChatInputHandle } from "@/components/chat/chat-input";
import { PinnedMessagesSidebar } from "@/components/chat/pinned-sidebar";
import { FilesContextSidebar } from "@/components/chat/files-context-sidebar";

export default function ChatPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { messages, isStreaming, sendMessage, stop, setHistory } = useStreamingChat(groupId);
  const { data: history, isSuccess } = useChatHistory(groupId);
  const { data: files } = useGroupFiles(groupId);
  const anyReady = (files ?? []).some((f) => f.status === "ready");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (isSuccess && history?.messages && !hydrated.current) { hydrated.current = true; setHistory(history.messages); }
  }, [isSuccess, history, setHistory]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const onSuggestion = useCallback((s: string) => inputRef.current?.setText(s), []);

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 h-[calc(100vh-12rem)]">
      <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto">
        <PinnedMessagesSidebar groupId={groupId} />
        <FilesContextSidebar groupId={groupId} />
      </aside>

      <div className="flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="font-sora text-lg font-semibold text-primary">Ask anything about your files</p>
              <p className="text-sm text-slate-500 mt-1">Answers come with citations from your documents.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} id={`msg-${m.id}`}>
                <MessageBubble message={m} groupId={groupId} onSuggestionClick={onSuggestion} />
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {!anyReady && (files?.length ?? 0) > 0 && (
          <div className="my-2 px-3 py-2 rounded-lg bg-amber/10 text-xs text-amber font-medium text-center">
            ⚠️ Files are still processing — chat may not have full context yet
          </div>
        )}
        {(files?.length ?? 0) === 0 && (
          <div className="my-2 px-3 py-2 rounded-lg bg-amber/10 text-xs text-amber font-medium text-center">
            Upload at least one file before chatting
          </div>
        )}

        <div className="pt-3">
          <ChatInput ref={inputRef} onSend={sendMessage} onStop={stop} isStreaming={isStreaming} disabled={!anyReady} />
          <p className="text-center text-[10px] text-slate-400 mt-2">Shift+Enter = new line · Enter = send</p>
        </div>
      </div>
    </div>
  );
}
