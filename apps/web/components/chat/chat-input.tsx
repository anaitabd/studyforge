"use client";

import { useRef, useState, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isStreaming, onSend]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask a question about your files…"
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
        style={{ maxHeight: 200 }}
      />
      <button
        onClick={isStreaming ? onStop : submit}
        disabled={!isStreaming && (!value.trim() || disabled)}
        className={cn(
          "shrink-0 p-2 rounded-xl transition-colors",
          isStreaming
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        )}
        aria-label={isStreaming ? "Stop" : "Send"}
      >
        {isStreaming ? <Square size={16} /> : <Send size={16} />}
      </button>
    </div>
  );
}
