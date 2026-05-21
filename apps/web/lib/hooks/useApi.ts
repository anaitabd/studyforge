"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";

export interface Group {
  id: string; name: string; description: string | null;
  color?: string; owner_id: string; plan?: string;
  file_count: number; member_count: number;
  my_role?: "owner" | "teacher" | "student";
  created_at: string; updated_at: string;
}
export interface GroupFile {
  id: string; group_id: string; name: string; size: number; mime_type: string;
  status: "uploading" | "processing" | "ready" | "error";
  error_message: string | null; chunk_count?: number; created_at: string;
}
export interface ChatMessage {
  id: string; role: "user" | "assistant"; content: string;
  citations?: Array<{ file_name: string; page: number; excerpt: string; file_id: string; chunk_index: number; similarity_score: number }>;
  suggestions?: string[]; is_pinned?: boolean; created_at?: string;
}
export interface Exam {
  id: string; group_id: string; title: string;
  status: "draft" | "assigned" | "closed";
  config: Record<string, unknown>; attempt_limit: number;
  starts_at: string | null; ends_at: string | null; created_at: string;
}
export interface FlashcardSet {
  id: string; title: string; group_id: string; file_id: string | null;
  card_count: number; due_count: number; created_at: string;
}
export interface StudyRoom {
  id: string; group_id: string; name: string; invite_code: string;
  is_active: boolean; created_at: string; member_count: number; online_count?: number;
}

export function usePinnedMessages(groupId: string) {
  return useQuery<{ messages: ChatMessage[] }>({ queryKey: ["pinned", groupId], queryFn: () => apiGet(`/api/v1/groups/${groupId}/chat/pinned`), enabled: !!groupId });
}

export function useNotifications() {
  return useQuery<Array<{ id: string; title: string; body: string; link: string | null; is_read: boolean; created_at: string }>>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const data = await apiGet("/api/v1/notifications");
      return (data as any)?.notifications ?? data;
    },
    staleTime: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPut(`/api/v1/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPut("/api/v1/notifications/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
