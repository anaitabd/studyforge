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

const unwrap = <T,>(data: any, key: string): T => data?.[key] ?? data;

/**
 * @deprecated Use the dedicated hook in use-groups.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useGroups() {
  return useQuery<Group[]>({ queryKey: ["groups"], queryFn: async () => unwrap(await apiGet("/api/v1/groups"), "groups"), staleTime: 30_000 });
}
/**
 * @deprecated Use the dedicated hook in use-groups.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useGroup(groupId: string) {
  return useQuery<Group & { files: GroupFile[] }>({ queryKey: ["groups", groupId], queryFn: () => apiGet(`/api/v1/groups/${groupId}`), enabled: !!groupId });
}
/**
 * @deprecated Use the dedicated hook in use-files.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useGroupFiles(groupId: string) {
  return useQuery<GroupFile[]>({
    queryKey: ["files", groupId],
    queryFn: async () => unwrap(await apiGet(`/api/v1/groups/${groupId}/files`), "files"),
    refetchInterval: (q) => (q.state.data?.some((f) => f.status === "processing" || f.status === "uploading") ? 3000 : false),
    enabled: !!groupId,
  });
}
export function useFileStatus(groupId: string, fileId: string) {
  return useQuery<GroupFile>({
    queryKey: ["fileStatus", fileId],
    queryFn: () => apiGet(`/api/v1/groups/${groupId}/files/${fileId}/status`),
    refetchInterval: (q) => (["uploading", "processing"].includes(q.state.data?.status ?? "") ? 2000 : false),
    enabled: !!groupId && !!fileId,
  });
}
/**
 * @deprecated Use the dedicated hook in use-chat.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useChatHistory(groupId: string) {
  return useQuery<{ messages: ChatMessage[] }>({ queryKey: ["chat", groupId], queryFn: () => apiGet(`/api/v1/groups/${groupId}/chat/history`), enabled: !!groupId });
}
export function usePinnedMessages(groupId: string) {
  return useQuery<{ messages: ChatMessage[] }>({ queryKey: ["pinned", groupId], queryFn: () => apiGet(`/api/v1/groups/${groupId}/chat/pinned`), enabled: !!groupId });
}
/**
 * @deprecated Use the dedicated hook in use-exams.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useExams(groupId: string) {
  return useQuery<Exam[]>({ queryKey: ["exams", groupId], queryFn: async () => unwrap(await apiGet(`/api/v1/groups/${groupId}/exams`), "exams"), enabled: !!groupId });
}
export function useExam(groupId: string, examId: string) {
  return useQuery<Exam>({ queryKey: ["exam", examId], queryFn: () => apiGet(`/api/v1/groups/${groupId}/exams/${examId}`), enabled: !!examId });
}
/**
 * @deprecated Use the dedicated hook in use-flashcards.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useFlashcardSets(groupId: string) {
  return useQuery<FlashcardSet[]>({ queryKey: ["flashcards", groupId], queryFn: async () => unwrap(await apiGet(`/api/v1/groups/${groupId}/flashcards`), "sets"), enabled: !!groupId });
}
export function useFlashcardSet(groupId: string, setId: string) {
  return useQuery({ queryKey: ["flashcardSet", setId], queryFn: () => apiGet(`/api/v1/groups/${groupId}/flashcards/${setId}`), enabled: !!setId });
}
export function useStudyDue(groupId: string, setId: string) {
  return useQuery({ queryKey: ["studyDue", setId], queryFn: async () => unwrap(await apiGet(`/api/v1/groups/${groupId}/flashcards/${setId}/study`), "cards"), enabled: !!setId, staleTime: 0 });
}
/**
 * @deprecated Use the dedicated hook in use-rooms.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useRooms(groupId: string) {
  return useQuery<StudyRoom[]>({ queryKey: ["rooms", groupId], queryFn: async () => unwrap(await apiGet(`/api/v1/rooms/group/${groupId}`), "rooms"), enabled: !!groupId });
}
/**
 * @deprecated Use the dedicated hook in use-teacher.ts instead.
 * This hook has a different query key causing cache divergence.
 */
export function useTeacherAnalytics(groupId: string, enabled = true) {
  return useQuery({ queryKey: ["analytics", groupId], queryFn: () => apiGet(`/api/v1/teacher/groups/${groupId}/analytics`), enabled: !!groupId && enabled });
}

export function useNotifications() {
  return useQuery<Array<{ id: string; title: string; body: string; link: string | null; is_read: boolean; created_at: string }>>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const data = await apiGet("/api/v1/notifications");
      return unwrap(data, "notifications");
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
