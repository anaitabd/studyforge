"use client";
import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

// ─── File types ───────────────────────────────────────────────────────────────

export interface GroupFile {
  id: string;
  name: string;
  mime_type: string;
  file_type: string;
  chunk_count: number;
  size_bytes: number;
  status: "uploading" | "processing" | "ready" | "error";
  created_at: string;
}

export function useGroupFilesForGenerate(groupId: string) {
  return useQuery<GroupFile[]>({
    queryKey: ["files-generate", groupId],
    queryFn: async () => {
      const data = await apiGet<{ files: GroupFile[] }>(
        `/api/v1/groups/${groupId}/files`
      );
      return data.files ?? [];
    },
    enabled: !!groupId,
    staleTime: 15_000,
    refetchInterval: (q) => {
      const hasInflight = q.state.data?.some((f) =>
        f.status === "uploading" || f.status === "processing"
      );
      return hasInflight ? 5_000 : false;
    },
  });
}

// ─── Generation payloads ──────────────────────────────────────────────────────

export interface GenerateExamPayload {
  title: string;
  file_ids: string[];
  question_count: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  question_types?: string[];
  subject_area?: string;
  level?: string;
  language?: string;
}

export interface GenerateFlashcardsPayload {
  title: string;
  file_ids: string[];
  max_cards: number;
}

export interface GeneratePathPayload {
  title: string;
  file_ids: string[];
  module_count: number;
}

export interface GenerateSlidesPayload {
  title: string;
  file_ids: string[];
  course_name?: string;
  style?: string;
  language?: string;
}

// ─── Generate mutations ───────────────────────────────────────────────────────

export function useGenerateExam(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateExamPayload) =>
      apiPost<{ id?: string; exam_id?: string; status?: string }>(
        `/api/v1/groups/${groupId}/exams/generate`,
        data
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams", groupId] }),
  });
}

export function useGenerateFlashcards(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateFlashcardsPayload) =>
      apiPost<{ id?: string; set_id?: string }>(
        `/api/v1/groups/${groupId}/flashcards/generate`,
        data
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcards", groupId] }),
  });
}

export function useGeneratePath(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GeneratePathPayload) =>
      apiPost<{ id?: string; path_id?: string }>(
        `/api/v1/groups/${groupId}/learning-paths/generate`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["learning-paths", groupId] }),
  });
}

export function useGenerateSlides(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateSlidesPayload) =>
      apiPost<{ id: string; status: string; estimated_seconds?: number }>(
        `/api/v1/groups/${groupId}/slide-decks`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["slide-decks", groupId] }),
  });
}

// ─── Slide deck polling ───────────────────────────────────────────────────────

export interface SlideDeckStatus {
  id: string;
  title: string;
  status: "generating" | "ready" | "error";
  error_message: string | null;
  slide_count: number;
  pptx_url: string | null;
}

export function usePollSlideDeck(groupId: string, deckId: string | null) {
  const retryCount = useRef(0);

  return useQuery<SlideDeckStatus>({
    queryKey: ["slide-deck-poll", groupId, deckId],
    queryFn: () =>
      apiGet<SlideDeckStatus>(
        `/api/v1/groups/${groupId}/slide-decks/${deckId}`
      ),
    enabled: !!deckId,
    staleTime: 0,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!deckId || status === "ready" || status === "error") {
        retryCount.current = 0;
        return false;
      }
      retryCount.current += 1;
      return retryCount.current > 10 ? 10_000 : 3_000;
    },
  });
}

// ─── Generation history ───────────────────────────────────────────────────────

export interface HistoryItem {
  id: string;
  type: "exam" | "flashcards" | "learning_path" | "slides";
  title: string;
  status: "processing" | "ready" | "error";
  file_count: number;
  created_at: string;
  result_url: string;
}

export function useGenerationHistory(groupId: string) {
  return useQuery<HistoryItem[]>({
    queryKey: ["generate-history", groupId],
    queryFn: () =>
      apiGet<HistoryItem[]>(
        `/api/v1/teacher/groups/${groupId}/generate-history`
      ),
    enabled: !!groupId,
    staleTime: 10_000,
    refetchInterval: (q) => {
      const hasProcessing = q.state.data?.some((i) => i.status === "processing");
      return hasProcessing ? 5_000 : false;
    },
  });
}
