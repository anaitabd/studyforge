"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

export interface PersonalKpis {
  active_minutes_today: number;
  cards_due_today: number;
  cards_overdue: number;
  flashcard_retention_rate: number | null;
  exam_score_trend: number[];
}

export interface StreakData {
  current: number;
  longest: number;
  today_active: boolean;
  last_active_date: string | null;
}

// Backend returns a flat string[] — no frequency data available yet.
export type WeakArea = string;

export interface StudyGoal {
  id: string;
  title: string;
  subject: string | null;
  target_date: string | null;
  target_score: number | null;
  status: "active" | "achieved" | "abandoned";
  days_remaining: number | null;
  file_ids: string[];
  created_at: string;
}

export function usePersonalKpis() {
  return useQuery<PersonalKpis>({
    queryKey: ["personal-kpis"],
    queryFn: () => apiGet("/api/v1/me/kpis"),
    staleTime: 60_000,
  });
}

export function useStreak() {
  return useQuery<StreakData>({
    queryKey: ["streak"],
    queryFn: () => apiGet("/api/v1/me/streak"),
    staleTime: 60_000,
  });
}

export function useWeakAreas() {
  return useQuery<string[]>({
    queryKey: ["weak-areas"],
    queryFn: async () => {
      const data = await apiGet<{ weak_areas: string[] }>("/api/v1/me/weak-areas");
      return data.weak_areas ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useGoals() {
  return useQuery<StudyGoal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const data = await apiGet<{ goals: StudyGoal[] }>("/api/v1/me/goals");
      return data.goals ?? data;
    },
    staleTime: 30_000,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      subject?: string;
      target_date?: string;
      target_score?: number;
    }) => apiPost("/api/v1/me/goals", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      title?: string;
      status?: string;
      target_date?: string;
      target_score?: number;
    }) => apiPatch(`/api/v1/me/goals/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}
