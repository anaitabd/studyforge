"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { LONG_AI_REQUEST_TIMEOUT_MS } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BacBranch = "SM" | "SE" | "SEco" | "SH" | "SAgro" | "SA" | "Lettres" | "Arts";
export type BacSession = "normale" | "rattrapage";
export type BacRegion = "nationale" | "regionale";
export type QuestionType = "mcq_single" | "open_calculation" | "essay" | "document_analysis" | "fill_blank" | "true_false";

export interface BacPaper {
  id: string;
  year: number;
  branch: BacBranch;
  subject: string;
  region: BacRegion;
  session: BacSession;
  title: string;
  duration_minutes: number;
  total_points: number;
  question_count: number;
  my_attempt_count: number;
  my_avg_score: number | null;
}

export interface BacQuestion {
  id: string;
  order_index: number;
  part_label: string | null;
  type: QuestionType;
  content: string;
  options: Record<string, string> | null;
  points: number;
  subject_area: string | null;
  // Only present after submission
  correct_answer?: string;
  explanation_fr?: string;
  explanation_ar?: string;
  rubric?: Array<{ criteria: string; max_points: number; description_fr: string; description_ar: string }>;
}

export interface QuestionScore {
  score: number;
  max_points: number;
  feedback_fr: string;
  feedback_ar: string;
  criteria_scores: Array<{ criteria: string; awarded: number; max: number; comment_fr: string }>;
  correct_answer: string;
  explanation_fr: string;
  explanation_ar: string;
}

export interface PracticeSession {
  session_id: string;
  paper: {
    id: string;
    year: number;
    branch: BacBranch;
    subject: string;
    title: string;
    duration_minutes: number;
    total_points: number;
    region: BacRegion;
    session_type: BacSession;
  };
  questions: BacQuestion[];
  started_at: string;
  submitted_at: string | null;
  answers: Record<string, string>;
  score_over_20: number | null;
  per_question_scores: Record<string, QuestionScore> | null;
  grading_status: "pending" | "grading" | "graded" | "error";
  duration_minutes: number;
}

export interface BacStats {
  overall_average: number | null;
  total_sessions: number;
  subject_averages: Record<string, number>;
  score_history: Array<{
    date: string;
    score: number;
    subject: string;
    branch: string;
    paper_title: string;
    session_id: string;
  }>;
}

export interface BacMeta {
  branches: BacBranch[];
  subjects_by_branch: Record<BacBranch, string[]>;
  sessions: BacSession[];
  regions: BacRegion[];
  year_range: { min: number; max: number };
}

export interface PapersFilters {
  year?: number;
  branch?: BacBranch;
  subject?: string;
  session?: BacSession;
  region?: BacRegion;
  offset?: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useBacMeta() {
  return useQuery<BacMeta>({
    queryKey: ["bac", "meta"],
    queryFn: () => api.get("/api/v1/bac/papers/meta").then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useBacPapers(filters: PapersFilters = {}) {
  return useQuery<{ papers: BacPaper[]; total: number }>({
    queryKey: ["bac", "papers", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", String(filters.year));
      if (filters.branch) params.set("branch", filters.branch);
      if (filters.subject) params.set("subject", filters.subject);
      if (filters.session) params.set("session", filters.session);
      if (filters.region) params.set("region", filters.region);
      if (filters.offset) params.set("offset", String(filters.offset));
      return api.get(`/api/v1/bac/papers?${params}`).then((r) => r.data);
    },
    staleTime: 60_000,
  });
}

export function useBacSession(sessionId: string) {
  return useQuery<PracticeSession>({
    queryKey: ["bac", "session", sessionId],
    queryFn: () => api.get(`/api/v1/bac/practice/${sessionId}`).then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useBacStats() {
  return useQuery<BacStats>({
    queryKey: ["bac", "stats"],
    queryFn: () => api.get("/api/v1/bac/stats").then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useStartBacPractice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paperId: string) =>
      api.post<PracticeSession>("/api/v1/bac/practice", { paper_id: paperId }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["bac", "session", data.session_id], data);
    },
  });
}

export function useSubmitBacSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      answers,
      timeSpentS,
    }: {
      sessionId: string;
      answers: Record<string, string>;
      timeSpentS: number;
    }) =>
      api
        .post(
          `/api/v1/bac/practice/${sessionId}/submit`,
          { answers, time_spent_s: timeSpentS },
          { timeout: LONG_AI_REQUEST_TIMEOUT_MS },
        )
        .then((r) => r.data),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["bac", "session", sessionId] });
      qc.invalidateQueries({ queryKey: ["bac", "papers"] });
      qc.invalidateQueries({ queryKey: ["bac", "stats"] });
    },
  });
}
