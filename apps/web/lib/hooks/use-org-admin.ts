"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export interface CohortStudent {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  last_active: string | null;
  avg_exam_score: number | null;
  paths_completed: number;
  paths_total: number;
  flashcard_retention: number | null;
  is_at_risk: boolean;
}

export interface AssignmentStatusCounts {
  not_started: number;
  in_progress: number;
  submitted: number;
  graded: number;
}

export interface CohortAssignment {
  id: string;
  title: string;
  resource_type: "exam" | "learning_path";
  resource_id: string;
  group_id: string;
  due_at: string | null;
  instructions: string | null;
  submitted_count: number;
  total_count: number;
  status_counts: AssignmentStatusCounts;
}

export interface LiveStudent {
  id: string;
  name: string;
  current_file: string | null;
  last_active_ago: string;
}

export interface CohortLiveData {
  online_count: number;
  students: LiveStudent[];
}

export interface AssignmentProgress {
  status: "not_started" | "in_progress" | "submitted" | "graded";
  score_over_20: number | null;
}

export interface Assignment {
  id: string;
  title: string;
  resource_type: "exam" | "learning_path";
  resource_id: string;
  group_id: string;
  due_at: string | null;
  instructions: string | null;
  progress: AssignmentProgress | null;
}

export interface StudentProfile {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  cohort_name: string | null;
  last_active: string | null;
  weak_areas: string[];
  exam_score_trend: number[];
}

export interface DauPoint {
  date: string;
  count: number;
}

export function useCohortStudents(slug: string, cohortId: string) {
  return useQuery<CohortStudent[]>({
    queryKey: ["cohort-students", slug, cohortId],
    queryFn: async () => {
      const data = await apiGet<{ students: CohortStudent[] }>(
        `/api/v1/org/${slug}/cohorts/${cohortId}/students`
      );
      return data.students ?? (data as unknown as CohortStudent[]);
    },
    enabled: !!slug && !!cohortId,
    staleTime: 30_000,
  });
}

export function useCohortAssignments(slug: string, cohortId: string) {
  return useQuery<CohortAssignment[]>({
    queryKey: ["cohort-assignments", slug, cohortId],
    queryFn: async () => {
      const data = await apiGet<{ assignments: CohortAssignment[] }>(
        `/api/v1/org/${slug}/cohorts/${cohortId}/assignments`
      );
      return data.assignments ?? (data as unknown as CohortAssignment[]);
    },
    enabled: !!slug && !!cohortId,
    staleTime: 30_000,
  });
}

export function useCohortLive(slug: string, cohortId: string) {
  return useQuery<CohortLiveData>({
    queryKey: ["cohort-live", slug, cohortId],
    queryFn: () => apiGet(`/api/v1/org/${slug}/cohorts/${cohortId}/live`),
    enabled: !!slug && !!cohortId,
    refetchInterval: 15_000,
    staleTime: 0,
  });
}

export function useMyAssignments(slug: string) {
  return useQuery<Assignment[]>({
    queryKey: ["my-assignments", slug],
    queryFn: async () => {
      const data = await apiGet<{ assignments: Assignment[] }>(
        `/api/v1/org/${slug}/assignments/my`
      );
      return data.assignments ?? (data as unknown as Assignment[]);
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useStudentProfile(slug: string, userId: string) {
  return useQuery<StudentProfile>({
    queryKey: ["student-profile", slug, userId],
    queryFn: () => apiGet(`/api/v1/org/${slug}/students/${userId}`),
    enabled: !!slug && !!userId,
    staleTime: 30_000,
  });
}

export function useDauTrend(slug: string) {
  return useQuery<DauPoint[]>({
    queryKey: ["dau-trend", slug],
    queryFn: async () => {
      const data = await apiGet<{ trend: DauPoint[] }>(
        `/api/v1/org/${slug}/kpis/dau-trend`
      );
      return data.trend ?? (data as unknown as DauPoint[]);
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useBulkInvite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emails: string[]) =>
      apiPost(`/api/v1/org/${slug}/members/bulk-invite`, { emails }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", slug] }),
  });
}
