"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useFiles(groupId: string) {
  const qc = useQueryClient();

  const query = useQuery<GroupFile[]>({
    queryKey: ["files", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/files`);
      return res.data.files ?? res.data;
    },
  });

  // Poll for status while any file is not terminal
  const pendingCount = query.data?.filter(
    (f) => f.status === "uploading" || f.status === "processing"
  ).length ?? 0;

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

  return query;
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
