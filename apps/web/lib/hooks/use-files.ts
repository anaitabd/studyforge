"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import api from "@/lib/api";

export interface GroupFile {
  id: string;
  group_id: string;
  name: string;
  size: number;
  mime_type: string;
  status: "uploading" | "processing" | "ready" | "error";
  error_message: string | null;
  indexed_at: string | null;
  created_at: string;
}

interface FilesPage {
  items: GroupFile[];
  next_cursor: string | null;
  total: number;
}

export function useFiles(groupId: string, status?: string) {
  const qc = useQueryClient();

  const query = useInfiniteQuery<FilesPage>({
    queryKey: ["files", groupId, status],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) params.set("cursor", pageParam as string);
      if (status) params.set("status", status);
      const res = await api.get(`/api/v1/groups/${groupId}/files?${params}`);
      return res.data as FilesPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const allFiles = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  const pendingCount = allFiles.filter(
    (f) => f.status === "uploading" || f.status === "processing"
  ).length;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pendingCount > 0) {
      intervalRef.current = setInterval(() => {
        qc.invalidateQueries({ queryKey: ["files", groupId] });
      }, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pendingCount, groupId, qc]);

  return { ...query, allFiles, total };
}

export function useUploadFile(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/api/v1/groups/${groupId}/files`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as GroupFile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", groupId] }),
  });
}

export function useDeleteFile(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/api/v1/groups/${groupId}/files/${fileId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", groupId] }),
  });
}

export function useDownloadFile(groupId: string) {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const res = await api.get<{ url: string; name: string }>(`/api/v1/groups/${groupId}/files/${fileId}/download`);
      return res.data;
    },
  });
}

export function useRetryFile(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      const res = await api.post(`/api/v1/groups/${groupId}/files/${fileId}/retry`);
      return res.data as { message: string; status: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", groupId] }),
  });
}
