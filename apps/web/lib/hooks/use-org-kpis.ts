"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

export interface OrgKpisOverview {
  dau: number;
  wau: number;
  avg_exam_score: number | null;
  at_risk_count: number;
  total_members: number;
}

export interface CohortKpiSummary {
  cohort_id: string;
  cohort_name: string;
  dau: number;
  avg_exam_score: number | null;
  at_risk_count: number;
}

export interface AtRiskStudent {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  last_active: string | null;
  days_inactive: number;
}

export interface StudentTimelineEvent {
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  time: string;
}

export function useOrgKpisOverview(slug: string) {
  return useQuery<OrgKpisOverview>({
    queryKey: ["org-kpis-overview", slug],
    queryFn: () => apiGet(`/api/v1/org/${slug}/kpis/overview`),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useCohortsKpis(slug: string) {
  return useQuery<CohortKpiSummary[]>({
    queryKey: ["cohorts-kpis", slug],
    queryFn: async () => {
      const data = await apiGet<{ cohorts: CohortKpiSummary[] }>(`/api/v1/org/${slug}/kpis/cohorts`);
      return data.cohorts ?? data;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useCohortKpis(slug: string, cohortId: string) {
  return useQuery<CohortKpiSummary>({
    queryKey: ["cohort-kpis", slug, cohortId],
    queryFn: () => apiGet(`/api/v1/org/${slug}/cohorts/${cohortId}/kpis`),
    enabled: !!slug && !!cohortId,
    staleTime: 60_000,
  });
}

export function useAtRiskStudents(slug: string) {
  return useQuery<AtRiskStudent[]>({
    queryKey: ["at-risk-students", slug],
    queryFn: async () => {
      const data = await apiGet<{ students: AtRiskStudent[] }>(`/api/v1/org/${slug}/kpis/at-risk`);
      return data.students ?? data;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useStudentTimeline(slug: string, userId: string) {
  return useQuery<StudentTimelineEvent[]>({
    queryKey: ["student-timeline", slug, userId],
    queryFn: async () => {
      const data = await apiGet<{ events: StudentTimelineEvent[] }>(
        `/api/v1/org/${slug}/students/${userId}/timeline`
      );
      return data.events ?? data;
    },
    enabled: !!slug && !!userId,
    staleTime: 30_000,
  });
}
