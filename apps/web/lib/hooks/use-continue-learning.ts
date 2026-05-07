"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ContinueLearningItem {
  path_id: string;
  group_id: string;
  group_name: string;
  title: string;
  summary: string | null;
  module_count: number;
  completed_modules: number;
  progress_pct: number;
  next_module_id: string | null;
  next_module_title: string | null;
  last_activity_at: string | null;
  created_at: string;
}

export function useContinueLearning(limit = 6) {
  return useQuery<ContinueLearningItem[]>({
    queryKey: ["continue-learning", limit],
    queryFn: async () => {
      const res = await api.get(`/api/v1/me/continue-learning?limit=${limit}`);
      return res.data.items ?? [];
    },
    staleTime: 60_000,
  });
}
