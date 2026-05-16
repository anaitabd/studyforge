"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface StudentStat {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  exams_taken: number;
  avg_score: number | null;
  chat_count: number;
  files_read: number;
  active_minutes: number;
  joined_at: string;
}

export interface ExamSummary {
  id: string;
  title: string;
  status: string;
  submissions: number;
  avg_score: number | null;
  created_at: string;
}

export interface GroupAnalytics {
  group_id: string;
  group_name: string;
  member_count: number;
  student_count: number;
  file_count: number;
  total_chats: number;
  exam_count: number;
  students: StudentStat[];
  exams: ExamSummary[];
}

export function useGroupAnalytics(groupId: string) {
  return useQuery<GroupAnalytics>({
    queryKey: ["teacher-analytics", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/teacher/groups/${groupId}/analytics`);
      return res.data;
    },
  });
}
