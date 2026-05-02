"use client";

import { use, useEffect, useRef, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useChat, useChatHistory } from "@/lib/hooks/use-chat";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { messages, isStreaming, sendMessage, initFromHistory, stop } = useChat(groupId);
  const { data: history, isSuccess } = useChatHistory(groupId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (isSuccess && history && !initialized.current) {
      initialized.current = true;
      initFromHistory(history);
    }
  }, [isSuccess, history, initFromHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-4">
        <Link
          href={`/groups/${groupId}`}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-slate-900">Chat with files</h1>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <p className="text-slate-500 text-sm">Ask anything about the files in this group.</p>
            <p className="text-slate-400 text-xs">
              Answers will include source citations from your documents.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onSuggestionClick={handleSuggestion} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4">
        <ChatInput onSend={sendMessage} onStop={stop} isStreaming={isStreaming} />
        <p className="text-center text-xs text-slate-400 mt-2">
          Shift+Enter for a new line · Enter to send
        </p>
      </div>
    </div>
  );
}
