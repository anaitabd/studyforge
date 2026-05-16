"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface XPData {
  total_xp: number;
  level: number;
  level_title: string;
  xp_to_next_level: number;
  recent_xp_log: { points: number; reason: string; earned_at: string }[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  xp_reward: number;
  earned_at: string;
}

export interface BadgesData {
  earned: Badge[];
  total_count: number;
  latest_badge: Badge | null;
}

export interface DailyChallenge {
  id: string;
  type: string;
  target: number;
  progress: number;
  progress_pct: number;
  xp_reward: number;
  completed: boolean;
  expires_at: string;
}

export interface LeaderboardMember {
  rank: number;
  user_id: string;
  name: string;
  level: number;
  level_title: string;
  total_xp: number;
  is_me: boolean;
}

export interface LeaderboardData {
  members: LeaderboardMember[];
  my_rank: number;
  my_user_id: string;
}

export function useMyXP() {
  return useQuery<XPData>({
    queryKey: ["me", "xp"],
    queryFn: async () => {
      const res = await api.get("/api/v1/me/xp");
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function useMyBadges() {
  return useQuery<BadgesData>({
    queryKey: ["me", "badges"],
    queryFn: async () => {
      const res = await api.get("/api/v1/me/badges");
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useDailyChallenge() {
  return useQuery<DailyChallenge>({
    queryKey: ["me", "challenge", "today"],
    queryFn: async () => {
      const res = await api.get("/api/v1/me/challenge/today");
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useGroupLeaderboard(groupId: string) {
  return useQuery<LeaderboardData>({
    queryKey: ["groups", groupId, "leaderboard"],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/leaderboard`);
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!groupId,
  });
}

export function useUpdateChallengeProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, increment }: { type: string; increment: number }) => {
      const res = await api.post("/api/v1/me/challenge/today/progress", { type, increment });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "challenge", "today"] });
      qc.invalidateQueries({ queryKey: ["me", "xp"] });
    },
  });
}
