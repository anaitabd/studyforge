"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

// Re-export everything from the specialised hooks so pages can import from one place.
export type { OrgKpisOverview, AtRiskStudent, CohortKpiSummary, StudentTimelineEvent } from "./use-org-kpis";
export { useOrgKpisOverview as useOrgKpis, useAtRiskStudents, useCohortKpis, useStudentTimeline } from "./use-org-kpis";
export type { Cohort } from "./use-cohorts";
export { useCohorts as useOrgCohorts, useCreateCohort } from "./use-cohorts";
export { useBulkInvite } from "./use-org-admin";

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "admin" | "teacher" | "student" | "viewer";
  joined_at: string;
}

export interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  size_range: string | null;
  is_active: boolean;
  created_at: string;
}

export function useOrg(slug: string) {
  return useQuery<OrgDetails>({
    queryKey: ["org", slug],
    queryFn: () => apiGet(`/api/v1/org/${slug}`),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useOrgMembers(slug: string) {
  return useQuery<OrgMember[]>({
    queryKey: ["org-members", slug],
    queryFn: async () => {
      const data = await apiGet<{ members: OrgMember[] }>(`/api/v1/org/${slug}/members`);
      return data.members ?? data;
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useInviteMember(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      apiPost(`/api/v1/org/${slug}/members/invite`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", slug] }),
  });
}

export function useUpdateMemberRole(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiPatch(`/api/v1/org/${slug}/members/${userId}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", slug] }),
  });
}

export function useRemoveMember(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiDelete(`/api/v1/org/${slug}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", slug] }),
  });
}
