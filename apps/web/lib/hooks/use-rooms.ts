"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface StudyRoom {
  id: string;
  group_id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  online_count?: number;
}

export function useRooms(groupId: string) {
  return useQuery<StudyRoom[]>({
    queryKey: ["rooms", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/rooms/group/${groupId}`);
      return res.data.rooms ?? res.data;
    },
  });
}

export function useCreateRoom(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post("/api/v1/rooms", { group_id: groupId, name });
      return res.data as StudyRoom;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", groupId] }),
  });
}

export function useJoinRoom(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const res = await api.post(`/api/v1/rooms/join/${inviteCode.toUpperCase()}`);
      return res.data as StudyRoom;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", groupId] }),
  });
}

export function useCloseRoom(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      await api.delete(`/api/v1/rooms/${roomId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms", groupId] }),
  });
}
