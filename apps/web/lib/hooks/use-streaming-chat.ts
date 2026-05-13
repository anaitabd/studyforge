"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken } from "@/lib/api";
import type { ChatMessage } from "@/lib/hooks/useApi";

export function useStreamingChat(groupId: string, initial: ChatMessage[] = []) {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const setHistory = useCallback((msgs: ChatMessage[]) => setMessages(msgs), []);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const sendMessage = useCallback(
    async (content: string, language = "auto") => {
      if (isStreaming || !content.trim()) return;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: content.trim(), created_at: new Date().toISOString() };
      const aId = crypto.randomUUID();
      const aMsg: ChatMessage = { id: aId, role: "assistant", content: "" };
      setMessages((p) => [...p, userMsg, aMsg]);
      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/groups/${groupId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message: content.trim(), language }),
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "Request failed");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6).trim());
              if (ev.type === "token") setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: m.content + (ev.content ?? "") } : m));
              else if (ev.type === "citations") setMessages((p) => p.map((m) => m.id === aId ? { ...m, citations: ev.data } : m));
              else if (ev.type === "suggestions") setMessages((p) => p.map((m) => m.id === aId ? { ...m, suggestions: ev.data } : m));
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: "Sorry, something went wrong. Try again." } : m));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        qc.invalidateQueries({ queryKey: ["chat-history", groupId] });
      }
    },
    [groupId, isStreaming, qc],
  );

  return { messages, isStreaming, sendMessage, stop, setHistory };
}
