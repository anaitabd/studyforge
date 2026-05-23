"use client";

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { LONG_AI_REQUEST_TIMEOUT_MS } from "@/lib/api";

export interface LearningPathSummary {
  id: string;
  title: string;
  summary: string | null;
  estimated_minutes: number;
  module_count: number;
  completed_modules: number;
  progress_pct: number;
  created_at: string;
}

export interface LearningPathModule {
  id: string;
  order_index: number;
  title: string;
  objectives: string[];
  key_concepts: string[];
  estimated_minutes: number;
  source_pages: number[];
  completed: boolean;
  content_markdown?: string;
  path_id?: string;
}

export interface LearningPathDetail {
  id: string;
  group_id: string;
  title: string;
  summary: string | null;
  estimated_minutes: number;
  language: string;
  file_ids: string[];
  modules: LearningPathModule[];
  module_count: number;
  completed_modules: number;
  progress_pct: number;
  created_at: string;
}

interface LearningPathsPage {
  items: LearningPathSummary[];
  next_cursor: string | null;
  total: number;
}

export function useLearningPaths(groupId: string) {
  const query = useInfiniteQuery<LearningPathsPage>({
    queryKey: ["learning-paths", groupId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await api.get(`/api/v1/groups/${groupId}/learning-paths?${params}`);
      return res.data as LearningPathsPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const allPaths = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  return { ...query, allPaths, total };
}

export function useLearningPath(groupId: string, pathId: string) {
  return useQuery<LearningPathDetail>({
    queryKey: ["learning-path", groupId, pathId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/learning-paths/${pathId}`);
      return res.data;
    },
    enabled: !!pathId,
  });
}

export function useLearningPathModule(groupId: string, pathId: string, moduleId: string) {
  return useQuery<LearningPathModule>({
    queryKey: ["learning-path-module", pathId, moduleId],
    queryFn: async () => {
      const res = await api.get(
        `/api/v1/groups/${groupId}/learning-paths/${pathId}/modules/${moduleId}`
      );
      return res.data;
    },
    enabled: !!moduleId,
  });
}

export function useGenerateLearningPath(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      module_count: number;
      language: string;
      file_ids?: string[];
    }) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/learning-paths/generate`,
        data,
        { timeout: LONG_AI_REQUEST_TIMEOUT_MS }
      );
      return res.data as LearningPathDetail;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-paths", groupId] }),
  });
}

export function useToggleModule(groupId: string, pathId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moduleId, completed }: { moduleId: string; completed: boolean }) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/learning-paths/${pathId}/modules/${moduleId}/progress`,
        { completed }
      );
      return res.data as { progress_pct: number; completed_modules: number; module_count: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learning-path", groupId, pathId] });
      qc.invalidateQueries({ queryKey: ["learning-paths", groupId] });
    },
  });
}

export function useDeleteLearningPath(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pathId: string) => {
      await api.delete(`/api/v1/groups/${groupId}/learning-paths/${pathId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning-paths", groupId] }),
  });
}
