"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

export interface Assignment {
  id: string;
  cohort_id: string;
  title: string;
  resource_type: string;
  resource_id: string;
  due_at: string | null;
  instructions: string | null;
  created_at: string;
}

export interface AssignmentProgressItem {
  user_id: string;
  name: string;
  email: string;
  status: "assigned" | "in_progress" | "submitted" | "graded";
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  feedback: string | null;
}

export function useAssignments(slug: string, cohortId: string) {
  return useQuery<Assignment[]>({
    queryKey: ["assignments", slug, cohortId],
    queryFn: async () => {
      const data = await apiGet<{ assignments: Assignment[] }>(
        `/api/v1/org/${slug}/cohorts/${cohortId}/assignments`
      );
      return data.assignments ?? data;
    },
    enabled: !!slug && !!cohortId,
    staleTime: 30_000,
  });
}

export function useAssignmentProgress(slug: string, assignmentId: string) {
  return useQuery<AssignmentProgressItem[]>({
    queryKey: ["assignment-progress", slug, assignmentId],
    queryFn: async () => {
      const data = await apiGet<{ progress: AssignmentProgressItem[] }>(
        `/api/v1/org/${slug}/assignments/${assignmentId}/progress`
      );
      return data.progress ?? data;
    },
    enabled: !!slug && !!assignmentId,
    staleTime: 15_000,
  });
}

export function useCreateAssignment(slug: string, cohortId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      resource_type: string;
      resource_id: string;
      due_at?: string;
      instructions?: string;
    }) => apiPost(`/api/v1/org/${slug}/cohorts/${cohortId}/assignments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments", slug, cohortId] }),
  });
}

export function useUpdateAssignmentProgress(slug: string, assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string; status?: string; score?: number; feedback?: string }) =>
      apiPatch(`/api/v1/org/${slug}/assignments/${assignmentId}/progress/${userId}`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["assignment-progress", slug, assignmentId] }),
  });
}
