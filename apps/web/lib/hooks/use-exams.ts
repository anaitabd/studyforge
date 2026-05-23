"use client";

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { LONG_AI_REQUEST_TIMEOUT_MS } from "@/lib/api";

export type QuestionType =
  | "mcq_single"
  | "mcq_multiple"
  | "true_false"
  | "fill_blank"
  | "open_calculation"
  | "essay"
  | "document_analysis"
  | "construction_photo";

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options: Record<string, string> | null;
  difficulty: string;
  order_index: number;
  points?: number;
  correct_answer?: string;
  explanation?: string;
  source_passage?: string;
}

export function getOptionsArray(options: Record<string, string> | null | undefined): string[] {
  if (!options || typeof options !== "object") return [];
  return Object.values(options);
}

export interface Exam {
  id: string;
  group_id: string;
  title: string;
  status: "draft" | "assigned" | "closed";
  config: Record<string, unknown>;
  total_points?: number;
  attempt_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  questions?: Question[];
}

export interface QuestionPayload {
  type?: string;
  content?: string;
  options?: Record<string, string> | null;
  correct_answer?: string | null;
  explanation?: string | null;
  difficulty?: string;
  points?: number;
  order_index?: number;
}

export interface Correction {
  question_id: string;
  type: QuestionType;
  question: string;
  options: Record<string, string> | null;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  explanation: string;
  source_passage: string | null;
  difficulty: string;
  points_earned: number | null;
  points_max: number;
  feedback: string | null;
}

export interface GradingResult {
  session_id: string;
  score: number;
  total: number;
  score_over_20: number | null;
  percentage: number;
  passed: boolean | null;
  grading_status: "pending" | "graded";
  time_spent_s: number;
  corrections: Correction[];
  ai_summary: string | null;
  weak_areas: string[];
  study_recommendations: string[];
}

interface ExamsPage {
  items: Exam[];
  next_cursor: string | null;
  total: number;
}

export function useExams(groupId: string) {
  const query = useInfiniteQuery<ExamsPage>({
    queryKey: ["exams", groupId],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await api.get(`/api/v1/groups/${groupId}/exams?${params}`);
      return res.data as ExamsPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const allExams = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  return { ...query, allExams, total };
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
      title?: string;
      question_count: number;
      difficulty: string;
      question_types?: string[];
      subject_area?: string;
      level?: string;
      language: string;
      file_ids?: string[];
    }) => {
      const res = await api.post(`/api/v1/groups/${groupId}/exams/generate`, data, {
        timeout: LONG_AI_REQUEST_TIMEOUT_MS,
      });
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

export function useAssignExam(groupId: string, examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { ends_at?: string; attempt_limit?: number; shuffle_questions?: boolean; shuffle_answers?: boolean }) => {
      const res = await api.patch(`/api/v1/groups/${groupId}/exams/${examId}/assign`, data);
      return res.data as Exam;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams", groupId] }),
  });
}

export function useAddQuestion(groupId: string, examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: QuestionPayload) => {
      const res = await api.post(`/api/v1/groups/${groupId}/exams/${examId}/questions`, data);
      return res.data as Question;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", groupId, examId] }),
  });
}

export function useUpdateQuestion(groupId: string, examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, data }: { questionId: string; data: QuestionPayload }) => {
      const res = await api.patch(
        `/api/v1/groups/${groupId}/exams/${examId}/questions/${questionId}`,
        data
      );
      return res.data as Question;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", groupId, examId] }),
  });
}

export function useDeleteQuestion(groupId: string, examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      await api.delete(`/api/v1/groups/${groupId}/exams/${examId}/questions/${questionId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", groupId, examId] }),
  });
}

export function useDuplicateQuestion(groupId: string, examId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const res = await api.post(
        `/api/v1/groups/${groupId}/exams/${examId}/questions/${questionId}/duplicate`
      );
      return res.data as Question;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam", groupId, examId] }),
  });
}

export function useUploadConstructionPhoto(
  groupId: string,
  examId: string,
  sessionId: string,
) {
  return useMutation({
    mutationFn: async ({ questionId, file }: { questionId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(
        `/api/v1/groups/${groupId}/exams/${examId}/sessions/${sessionId}/answers/${questionId}/photo`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res.data as { status: string; question_id: string };
    },
  });
}
