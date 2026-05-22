"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api";

export interface AccountUsage {
  chat_messages_today: number;
  chat_messages_limit_day: number;
  exams_generated_month: number;
  exams_limit_month: number;
  groups_count: number;
  groups_limit: number;
  files_uploaded_total: number;
}

export interface AccountSubscription {
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  plan: "free" | "personal" | "school";
  current_period_end: string | null;
  customer_id: string | null;
  cancel_at_period_end: boolean;
}

export interface AccountNotifications {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
}

export interface AccountData {
  id: string;
  clerk_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: "student" | "teacher" | "school_admin" | "super_admin";
  plan: "free" | "personal" | "school";
  org_id: string | null;
  account_type: "individual" | "org";
  school_name: string | null;
  whatsapp_number: string | null;
  created_at: string;
  usage: AccountUsage;
  subscription: AccountSubscription;
  notifications: AccountNotifications;
}

export function useAccount() {
  return useQuery<AccountData>({
    queryKey: ["account"],
    queryFn: () => apiGet("/api/v1/me/account"),
    staleTime: 60_000,
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { full_name?: string; whatsapp_number?: string | null }) =>
      apiPatch<AccountData>("/api/v1/me/account", data),
    onSuccess: (updated) => {
      qc.setQueryData(["account"], updated);
    },
  });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AccountNotifications>) =>
      apiPatch<AccountNotifications>("/api/v1/me/notifications", data),
    onSuccess: (updated) => {
      qc.setQueryData<AccountData>(["account"], (old) =>
        old ? { ...old, notifications: updated } : old
      );
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: () => apiPost<{ url: string }>("/api/v1/me/billing-portal"),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirmation: string) =>
      apiDelete<void>("/api/v1/me/account", { data: { confirmation } }),
  });
}
