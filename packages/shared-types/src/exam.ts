export type QuestionType = "mcq_single" | "mcq_multiple" | "true_false" | "fill_blank";
export type Difficulty = "easy" | "medium" | "hard" | "mixed";

export interface Question {
  id: string;
  exam_id: string;
  type: QuestionType;
  content: string;
  options: Record<string, string>;
  difficulty: string;
  order_index: number;
  correct_answer?: string; // hidden from students
}

export interface ExamSession {
  id: string;
  exam_id: string;
  user_id: string;
  answers: Record<string, string>;
  score?: number;
  total?: number;
  submitted_at?: string;
  started_at: string;
}
