"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Question {
  id: string;
  type: "mcq_single" | "mcq_multiple" | "true_false" | "fill_blank";
  content: string;
  options: string[] | null;
  difficulty: string;
  order_index: number;
  correct_answer?: string;
  explanation?: string;
  source_passage?: string;
}

export interface Exam {
  id: string;
  group_id: string;
  title: string;
  status: "draft" | "assigned" | "closed";
  config: Record<string, unknown>;
  attempt_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  questions?: Question[];
}

export interface Correction {
  question_id: string;
  question: string;
  options: string[] | null;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  source_passage: string | null;
  difficulty: string;
}

export interface GradingResult {
  session_id: string;
  score: number;
  total: number;
  percentage: number;
  time_spent_s: number;
  corrections: Correction[];
}

export function useExams(groupId: string) {
  return useQuery<Exam[]>({
    queryKey: ["exams", groupId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/exams`);
      return res.data.exams ?? res.data;
    },
  });
}

export function useExam(groupId: string, examId: string) {
  return useQuery<Exam>({
    queryKey: ["exam", groupId, examId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/groups/${groupId}/exams/${examId}`);
      return res.data;
    },
  });
}

export function useGenerateExam(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      question_count: number;
      difficulty: string;
      question_type: string;
      language: string;
      topic_focus?: string;
    }) => {
      const res = await api.post(`/api/v1/groups/${groupId}/exams/generate`, data);
      return res.data as Exam;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams", groupId] }),
  });
}

export function useStartSession(groupId: string, examId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/groups/${groupId}/exams/${examId}/sessions`, {});
      return res.data as { session_id: string; questions: Question[]; started_at: string };
    },
  });
}

export function useAutosave(groupId: string, examId: string, sessionId: string) {
  return useMutation({
    mutationFn: async (answers: Record<string, string>) => {
      await api.put(
        `/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}`,
        { answers }
      );
    },
  });
}

export function useSubmitExam(groupId: string, examId: string, sessionId: string) {
  return useMutation({
    mutationFn: async (answers: Record<string, string>) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}/submit`,
        { answers }
      );
      return res.data as GradingResult;
    },
  });
}
