"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useGenerateExam } from "@/lib/hooks/use-exams";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Props {
  groupId: string;
  open: boolean;
  onClose: () => void;
}

export function GenerateExamModal({ groupId, open, onClose }: Props) {
  const router = useRouter();
  const { mutate: generate, isPending } = useGenerateExam(groupId);
  const [form, setForm] = useState({
    title: "",
    question_count: 10,
    difficulty: "mixed",
    question_type: "mcq_single",
    language: "auto",
    topic_focus: "",
  });

  if (!open) return null;

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    generate(
      {
        title: form.title.trim(),
        question_count: form.question_count,
        difficulty: form.difficulty,
        question_type: form.question_type,
        language: form.language,
        topic_focus: form.topic_focus.trim() || undefined,
      },
      {
        onSuccess: (exam) => {
          toast.success("Exam generated!");
          onClose();
          router.push(`/groups/${groupId}/exams/${exam.id}`);
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Generate exam</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title *">
            <input
              className="input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Chapter 3 Quiz"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Questions">
              <input
                type="number"
                min={5}
                max={50}
                className="input"
                value={form.question_count}
                onChange={(e) => set("question_count", Number(e.target.value))}
              />
            </Field>
            <Field label="Difficulty">
              <select className="input" value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Question type">
              <select className="input" value={form.question_type} onChange={(e) => set("question_type", e.target.value)}>
                <option value="mcq_single">Multiple choice (single)</option>
                <option value="mcq_multiple">Multiple choice (multi)</option>
                <option value="true_false">True / False</option>
              </select>
            </Field>
            <Field label="Language">
              <select className="input" value={form.language} onChange={(e) => set("language", e.target.value)}>
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
                <option value="es">Spanish</option>
              </select>
            </Field>
          </div>

          <Field label="Topic focus (optional)">
            <input
              className="input"
              value={form.topic_focus}
              onChange={(e) => set("topic_focus", e.target.value)}
              placeholder="e.g. thermodynamics, chapter 5…"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
