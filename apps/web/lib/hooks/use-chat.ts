"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Citation {
  file_name: string;
  page: number;
  excerpt: string;
  file_id: string;
  chunk_index: number;
  similarity_score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  suggestions?: string[];
  is_pinned?: boolean;
  created_at?: string;
  streaming?: boolean;
}

export function useChatHistory(groupId: string) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chat-history", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/chat/history`);
      return res.data.messages;
    },
    staleTime: Infinity,
  });
}

export function useChat(groupId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const initFromHistory = useCallback((history: ChatMessage[]) => {
    setMessages(history);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      try {
        const token = api.defaults.headers.common["Authorization"] as string | undefined;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/groups/${groupId}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: token } : {}),
            },
            body: JSON.stringify({ message: text.trim() }),
            signal: abortRef.current.signal,
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Request failed" }));
          throw new Error(
            typeof err.detail === "string" ? err.detail : err.detail?.message ?? "Request failed"
          );
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: { type: string; content?: string; data?: unknown };
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            if (event.type === "token") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (event.content ?? "") }
                    : m
                )
              );
            } else if (event.type === "citations") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, citations: event.data as Citation[] } : m
                )
              );
            } else if (event.type === "suggestions") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, suggestions: event.data as string[] } : m
                )
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: event.content ?? "Error occurred", streaming: false }
                    : m
                )
              );
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Something went wrong. Please try again.", streaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [groupId, isStreaming]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, initFromHistory, stop };
}
