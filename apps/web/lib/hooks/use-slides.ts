"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface SlideQuiz {
  question: string;
  options: string[];
  correct_index?: number;
  rationale?: string;
}

export interface SlideExample {
  title: string;
  body: string;
}

export interface Slide {
  id: string;
  order_index: number;
  slide_type: "title" | "section" | "content" | "definition" | "example" | "quiz" | "summary";
  title: string;
  bullets: string[];
  detailed_explanation: string;
  examples: SlideExample[];
  speaker_notes: string;
  source_file: string | null;
  source_pages: number[];
  quiz: SlideQuiz | null;
  completed: boolean;
}

export interface SlideDeckSummary {
  id: string;
  title: string;
  course_name: string;
  status: "generating" | "ready" | "error";
  error_message: string | null;
  slide_count: number;
  language: string;
  created_at: string;
  my_progress_pct: number;
  my_completed_slides: number;
  my_current_slide_index: number;
}

export interface SlideDeckDetail {
  id: string;
  title: string;
  course_name: string;
  professor_name: string;
  style: string;
  language: string;
  status: "generating" | "ready" | "error";
  error_message: string | null;
  file_ids: string[];
  slide_count: number;
  created_at: string;
  slides: Slide[];
  my_progress: {
    current_slide_index: number;
    completed_slide_ids: string[];
    progress_pct: number;
  };
  my_quiz_answers: Record<string, { selected_index: number; is_correct: boolean }>;
}

export function useSlideDecks(groupId: string) {
  return useQuery<SlideDeckSummary[]>({
    queryKey: ["slide-decks", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/slide-decks`);
      return res.data.decks ?? [];
    },
    enabled: !!groupId,
    refetchInterval: (q) => {
      const data = q.state.data as SlideDeckSummary[] | undefined;
      return data?.some((d) => d.status === "generating") ? 3000 : false;
    },
  });
}

export function useSlideDeck(groupId: string, deckId: string) {
  return useQuery<SlideDeckDetail>({
    queryKey: ["slide-deck", groupId, deckId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/slide-decks/${deckId}`);
      return res.data;
    },
    enabled: !!groupId && !!deckId,
    refetchInterval: (q) => {
      const data = q.state.data as SlideDeckDetail | undefined;
      return data?.status === "generating" ? 3000 : false;
    },
  });
}

export function useGenerateSlideDeck(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      file_ids: string[];
      course_name?: string;
      professor_name?: string;
      style?: string;
      language?: string;
    }) => {
      const res = await api.post(`/api/v1/groups/${groupId}/slide-decks`, body);
      return res.data as { id: string; status: string; estimated_seconds: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slide-decks", groupId] }),
  });
}

export function useUpdateSlideProgress(groupId: string, deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      current_slide_index?: number;
      mark_slide_completed_id?: string;
    }) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/slide-decks/${deckId}/progress`,
        body
      );
      return res.data as {
        current_slide_index: number;
        completed_slide_ids: string[];
        progress_pct: number;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slide-deck", groupId, deckId] });
      qc.invalidateQueries({ queryKey: ["slide-decks", groupId] });
    },
  });
}

export function useAnswerSlideQuiz(groupId: string, deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { slideId: string; selected_index: number }) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/slide-decks/${deckId}/slides/${vars.slideId}/quiz`,
        { selected_index: vars.selected_index }
      );
      return res.data as {
        is_correct: boolean;
        correct_index: number;
        rationale: string;
        selected_index: number;
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slide-deck", groupId, deckId] }),
  });
}

export function useDeleteSlideDeck(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await api.delete(`/api/v1/groups/${groupId}/slide-decks/${deckId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slide-decks", groupId] }),
  });
}

export function getDeckPptxUrl(groupId: string, deckId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${base}/api/v1/groups/${groupId}/slide-decks/${deckId}/pptx`;
}
