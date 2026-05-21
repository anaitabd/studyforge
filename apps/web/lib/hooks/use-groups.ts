"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  plan: string;
  color: string | null;
  my_role: string | null;
  is_archived: boolean;
  file_count: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export function useGroups() {
  return useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await api.get("/api/v1/groups");
      return res.data.groups ?? res.data;
    },
  });
}

export function useGroup(groupId: string) {
  return useQuery<Group & { files: import("@/lib/hooks/use-files").GroupFile[] }>({
    queryKey: ["groups", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}`);
      return res.data;
    },
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post("/api/v1/groups", data);
      return res.data as Group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      await api.delete(`/api/v1/groups/${groupId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}
