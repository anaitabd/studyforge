"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

export interface Cohort {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  start_date: string | null;
  end_date: string | null;
  is_archived: boolean;
  member_count: number;
  created_at: string;
}

export interface CohortMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "teacher" | "student";
  joined_at: string;
}

export function useCohorts(slug: string) {
  return useQuery<Cohort[]>({
    queryKey: ["cohorts", slug],
    queryFn: async () => {
      const data = await apiGet<{ cohorts: Cohort[] }>(`/api/v1/org/${slug}/cohorts`);
      return data.cohorts ?? data;
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useCohort(slug: string, cohortId: string) {
  return useQuery<Cohort>({
    queryKey: ["cohort", slug, cohortId],
    queryFn: () => apiGet(`/api/v1/org/${slug}/cohorts/${cohortId}`),
    enabled: !!slug && !!cohortId,
    staleTime: 30_000,
  });
}

export function useCohortMembers(slug: string, cohortId: string) {
  return useQuery<CohortMember[]>({
    queryKey: ["cohort-members", slug, cohortId],
    queryFn: async () => {
      const data = await apiGet<{ members: CohortMember[] }>(
        `/api/v1/org/${slug}/cohorts/${cohortId}/members`
      );
      return data.members ?? data;
    },
    enabled: !!slug && !!cohortId,
    staleTime: 30_000,
  });
}

export function useCreateCohort(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; subject?: string; start_date?: string; end_date?: string }) =>
      apiPost(`/api/v1/org/${slug}/cohorts`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cohorts", slug] }),
  });
}

export function useAddCohortMember(slug: string, cohortId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; role: string }) =>
      apiPost(`/api/v1/org/${slug}/cohorts/${cohortId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cohort-members", slug, cohortId] }),
  });
}

export function useRemoveCohortMember(slug: string, cohortId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiDelete(`/api/v1/org/${slug}/cohorts/${cohortId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cohort-members", slug, cohortId] }),
  });
}
