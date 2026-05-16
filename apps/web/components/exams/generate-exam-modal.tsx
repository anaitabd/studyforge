"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, ArrowRight, ArrowLeft, Sparkles, FileText, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiPost, LONG_AI_REQUEST_TIMEOUT_MS } from "@/lib/api";
import { useGroupFiles } from "@/lib/hooks/useApi";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const QUESTION_TYPE_OPTIONS = [
  { value: "mcq_single", label: "MCQ" },
  { value: "mcq_multiple", label: "Multi-select" },
  { value: "true_false", label: "True/False" },
  { value: "fill_blank", label: "Fill blank" },
  { value: "open_calculation", label: "Calculation" },
  { value: "essay", label: "Essay" },
  { value: "document_analysis", label: "Document" },
] as const;

const SUBJECT_OPTIONS = ["", "Math", "French", "Arabic", "Sciences", "Physics", "History-Geography"];
const LEVEL_OPTIONS = ["", "1AC", "2AC", "3AC", "TC", "1BAC", "2BAC"];

export function GenerateExamModal({
  groupId,
  open,
  onClose,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: files } = useGroupFiles(groupId);
  const ready = (files ?? []).filter((f) => f.status === "ready");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    question_count: 10,
    difficulty: "mixed",
    question_types: [] as string[],
    subject_area: "",
    level: "",
    language: "auto",
  });

  const toggleQType = (val: string) =>
    setForm((f) => ({
      ...f,
      question_types: f.question_types.includes(val)
        ? f.question_types.filter((t) => t !== val)
        : [...f.question_types, val],
    }));

  const generate = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>(
        `/api/v1/groups/${groupId}/exams/generate`,
        {
          title: form.title.trim() || `Exam · ${new Date().toLocaleDateString()}`,
          question_count: form.question_count,
          difficulty: form.difficulty,
          question_types: form.question_types.length > 0 ? form.question_types : undefined,
          subject_area: form.subject_area || undefined,
          level: form.level || undefined,
          language: form.language,
          file_ids: selectedIds.length > 0 ? selectedIds : undefined,
        },
        { timeout: LONG_AI_REQUEST_TIMEOUT_MS }
      ),
    onSuccess: (e) => {
      toast.success("Exam generated!");
      onClose();
      router.push(`/groups/${groupId}/exams/${e.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) return null;
  const allSelected = selectedIds.length === ready.length && ready.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-sora text-lg font-semibold text-primary">Generate exam</h2>
            <p className="text-xs text-slate-500">Step {step} of 3</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1 — File selection */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-2">
                Pick which files to use ({ready.length} ready)
              </p>
              {ready.length === 0 ? (
                <div className="rounded-lg bg-amber/10 p-4 text-xs text-amber">
                  No files are ready yet. Wait for processing to finish.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(allSelected ? [] : ready.map((f) => f.id))
                    }
                    className="text-xs text-accent hover:underline font-medium"
                  >
                    {allSelected ? "Clear all" : "Select all ready files"}
                  </button>
                  <ul className="space-y-1 max-h-60 overflow-y-auto">
                    {ready.map((f) => {
                      const checked = selectedIds.includes(f.id);
                      return (
                        <li key={f.id}>
                          <label
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                              checked
                                ? "border-accent bg-accent/5"
                                : "border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedIds((p) =>
                                  p.includes(f.id)
                                    ? p.filter((x) => x !== f.id)
                                    : [...p, f.id]
                                )
                              }
                              className="accent-accent"
                            />
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <span className="text-sm truncate">{f.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-slate-500">
                    {selectedIds.length === 0
                      ? "All ready files will be used"
                      : `${selectedIds.length} selected`}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Step 2 — Exam settings */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Info chip */}
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                <Info size={13} className="shrink-0" />
                Exam scored /20 — Moroccan curriculum
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Title <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chapter 3 Quiz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Questions: {form.question_count}
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={form.question_count}
                  onChange={(e) =>
                    setForm({ ...form, question_count: Number(e.target.value) })
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Difficulty</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setForm({ ...form, difficulty: d })}
                      className={cn(
                        "py-2 rounded-lg text-xs font-medium capitalize transition-colors",
                        form.difficulty === d
                          ? "bg-accent text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Question types{" "}
                  <span className="text-slate-400 font-normal">(leave empty for mixed)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUESTION_TYPE_OPTIONS.map(({ value, label }) => {
                    const checked = form.question_types.includes(value);
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => toggleQType(value)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                          checked
                            ? "bg-accent text-white border-accent"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
                  <select
                    className="input"
                    value={form.subject_area}
                    onChange={(e) => setForm({ ...form, subject_area: e.target.value })}
                  >
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s || "Any"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Level</label>
                  <select
                    className="input"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                  >
                    {LEVEL_OPTIONS.map((l) => (
                      <option key={l} value={l}>
                        {l || "Any"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
                <select
                  className="input"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  <option value="auto">Auto</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="ar">Arabic</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3 — Generate */}
          {step === 3 && (
            <div className="text-center py-12">
              {generate.isPending ? (
                <>
                  <Loader2 className="mx-auto text-accent animate-spin mb-4" size={36} />
                  <p className="font-sora font-semibold text-primary">
                    Analyzing your course material…
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Large PDFs can take 1-3 minutes. Keep this tab open.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="mx-auto text-accent mb-4" size={36} />
                  <p className="font-sora font-semibold text-primary mb-1">Ready to generate</p>
                  <p className="text-sm text-slate-500 mb-6">
                    {form.question_count} {form.difficulty} questions from{" "}
                    {selectedIds.length || "all"} file(s)
                  </p>
                  <button
                    type="button"
                    onClick={() => generate.mutate()}
                    className="px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90"
                  >
                    Generate exam
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!(step === 3 && generate.isPending) && (
          <div className="flex justify-between p-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() =>
                step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : onClose()
              }
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> {step > 1 ? "Back" : "Cancel"}
            </button>
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
                disabled={step === 1 && ready.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
