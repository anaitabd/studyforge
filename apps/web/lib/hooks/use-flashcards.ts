"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface FlashcardSet {
  id: string;
  title: string;
  group_id: string;
  file_id: string | null;
  card_count: number;
  due_count: number;
  created_at: string;
}

export interface Flashcard {
  id: string;
  set_id: string;
  front: string;
  back: string;
  source_passage: string | null;
  progress?: {
    ease_factor: number;
    interval: number;
    repetitions: number;
    due_date: string;
  } | null;
}

export function useFlashcardSets(groupId: string) {
  return useQuery<FlashcardSet[]>({
    queryKey: ["flashcard-sets", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/flashcards`);
      return res.data.sets ?? res.data;
    },
  });
}

export function useDueCards(groupId: string, setId: string) {
  return useQuery<Flashcard[]>({
    queryKey: ["due-cards", setId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/flashcards/${setId}/study`);
      return res.data.cards ?? res.data;
    },
    staleTime: 0,
  });
}

export function useGenerateSet(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      max_cards: number;
      language: string;
    }) => {
      const res = await api.post(`/api/v1/groups/${groupId}/flashcards/generate`, data);
      return res.data as FlashcardSet;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcard-sets", groupId] }),
  });
}

export function useReviewCard(groupId: string, setId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: string }) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/flashcards/${setId}/cards/${cardId}/review`,
        { rating }
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["due-cards", setId] }),
  });
}

export function useDeleteSet(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (setId: string) => {
      await api.delete(`/api/v1/groups/${groupId}/flashcards/${setId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flashcard-sets", groupId] }),
  });
}
