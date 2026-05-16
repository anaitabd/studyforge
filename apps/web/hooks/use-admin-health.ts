"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

// ─── Health overview ──────────────────────────────────────────────────────────

export interface ServiceStatus {
  status: "ok" | "degraded" | "error";
  detail?: string;
  pool_size?: number;
  checked_out?: number;
  overflow?: number;
  provider?: string;
}

export interface HealthOverview {
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
    redis: ServiceStatus;
    vector_db: ServiceStatus;
    storage: ServiceStatus;
    ai_provider: ServiceStatus;
  };
  queues: { files: number; slides: number; notifications: number };
  checked_at: number;
}

export function useHealthOverview() {
  return useQuery<HealthOverview>({
    queryKey: ["admin-health-overview"],
    queryFn: () => apiGet<HealthOverview>("/api/v1/admin/health/overview"),
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

// ─── Stuck files ──────────────────────────────────────────────────────────────

export interface StuckFile {
  id: string;
  name: string;
  status: string;
  group_id: string;
  size_bytes: number;
  created_at: string;
  stuck_minutes: number;
}

export function useStuckFiles(minutes = 30) {
  return useQuery<StuckFile[]>({
    queryKey: ["admin-stuck-files", minutes],
    queryFn: () =>
      apiGet<StuckFile[]>(`/api/v1/admin/health/stuck-files?minutes=${minutes}`),
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function useRetryStuckFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiPost<{ ok: boolean }>(`/api/v1/admin/health/stuck-files/${fileId}/retry`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-stuck-files"] }),
  });
}

export function useMarkFileError() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiPost<{ ok: boolean }>(`/api/v1/admin/health/stuck-files/${fileId}/mark-error`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-stuck-files"] }),
  });
}

// ─── DLQ ─────────────────────────────────────────────────────────────────────

export interface DlqMessage {
  message_id: string;
  receipt_handle: string;
  body: string;
  sent_at: string | null;
  receive_count: string | null;
}

export interface DlqResponse {
  queue: string;
  messages: DlqMessage[];
  note?: string;
  error?: string;
}

export function useDlqMessages(queue: "files" | "slides" | "notifications") {
  return useQuery<DlqResponse>({
    queryKey: ["admin-dlq", queue],
    queryFn: () =>
      apiGet<DlqResponse>(`/api/v1/admin/health/dlq?queue=${queue}`),
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

export function useRetryDlqMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      receiptHandle,
      queue,
    }: {
      messageId: string;
      receiptHandle: string;
      queue: string;
    }) =>
      apiPost<{ ok: boolean }>(`/api/v1/admin/health/dlq/${messageId}/retry`, {
        receipt_handle: receiptHandle,
        queue,
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["admin-dlq", vars.queue] }),
  });
}

export function useDeleteDlqMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      receiptHandle,
      queue,
    }: {
      messageId: string;
      receiptHandle: string;
      queue: string;
    }) =>
      apiDelete<{ ok: boolean }>(
        `/api/v1/admin/health/dlq/${messageId}?receipt_handle=${encodeURIComponent(receiptHandle)}&queue=${queue}`
      ),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["admin-dlq", vars.queue] }),
  });
}

// ─── AI costs ─────────────────────────────────────────────────────────────────

export interface AiCosts {
  tracking_enabled: boolean;
  note?: string;
  total_cost_usd: number | null;
  top_consumers: { user_id: string; name: string; cost_usd: number }[];
  daily_chart: { date: string; cost_usd: number }[];
}

export function useAiCosts() {
  return useQuery<AiCosts>({
    queryKey: ["admin-ai-costs"],
    queryFn: () => apiGet<AiCosts>("/api/v1/admin/health/ai-costs"),
    staleTime: 60_000,
  });
}

// ─── User search ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  school: string | null;
  is_active: boolean;
  created_at: string;
}

export function useAdminUserSearch(q: string) {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-user-search", q],
    queryFn: () =>
      apiGet<AdminUser[]>(`/api/v1/admin/users/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

export function useOverrideUserPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      plan,
      reason,
    }: {
      userId: string;
      plan: string;
      reason?: string;
    }) =>
      apiPost<{ ok: boolean }>(`/api/v1/admin/users/${userId}/override-plan`, {
        plan,
        reason,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-user-search"] });
    },
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      apiPost<{ ok: boolean }>(`/api/v1/admin/users/${userId}/suspend`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-user-search"] }),
  });
}

// ─── Feature flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  enabled_for_plans: string[];
  updated_at: string;
}

export function useFeatureFlags() {
  return useQuery<FeatureFlag[]>({
    queryKey: ["admin-feature-flags"],
    queryFn: () => apiGet<FeatureFlag[]>("/api/v1/admin/feature-flags"),
    staleTime: 30_000,
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      enabled,
      enabled_for_plans,
    }: {
      key: string;
      enabled: boolean;
      enabled_for_plans?: string[];
    }) =>
      apiPatch<FeatureFlag>(`/api/v1/admin/feature-flags/${key}`, {
        enabled,
        enabled_for_plans,
      }),
    onSuccess: (updated) => {
      qc.setQueryData<FeatureFlag[]>(["admin-feature-flags"], (old) =>
        old
          ? old.map((f) => (f.key === updated.key ? updated : f))
          : old
      );
    },
  });
}
