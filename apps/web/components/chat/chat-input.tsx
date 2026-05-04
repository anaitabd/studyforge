"use client";

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
  { code: "es", label: "ES" },
];

export interface ChatInputHandle { setText: (s: string) => void }

interface Props { onSend: (text: string, language: string) => void; onStop: () => void; isStreaming: boolean; disabled?: boolean; }

export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ onSend, onStop, isStreaming, disabled }, ref) {
  const [value, setValue] = useState("");
  const [lang, setLang] = useState("auto");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({ setText: (s) => { setValue(s); taRef.current?.focus(); } }), []);

  const submit = useCallback(() => {
    const t = value.trim();
    if (!t || isStreaming) return;
    onSend(t, lang);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  }, [value, lang, isStreaming, onSend]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        disabled={disabled}
        placeholder={disabled ? "Add and process files first…" : "Ask a question about your files…"}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none px-2 py-1"
        style={{ maxHeight: 160 }}
      />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="text-[11px] font-medium text-slate-500 bg-transparent border border-slate-200 rounded-md px-1.5 py-1 outline-none cursor-pointer"
        aria-label="Language"
      >
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
      <button
        type="button"
        onClick={isStreaming ? onStop : submit}
        disabled={!isStreaming && (!value.trim() || disabled)}
        className={cn(
          "shrink-0 p-2 rounded-xl transition-colors",
          isStreaming ? "bg-destructive text-white hover:bg-destructive/90" : "bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed",
        )}
        aria-label={isStreaming ? "Stop" : "Send"}
      >
        {isStreaming ? <Square size={16} /> : <Send size={16} />}
      </button>
    </div>
  );
});
