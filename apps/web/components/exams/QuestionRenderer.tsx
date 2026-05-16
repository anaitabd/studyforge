"use client";

import { useRef, useState } from "react";
import { Loader2, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Question, getOptionsArray, useUploadConstructionPhoto } from "@/lib/hooks/use-exams";

interface InputProps {
  question: Question;
  answer: string | undefined;
  onAnswer: (questionId: string, value: string) => void;
}

interface RendererProps extends InputProps {
  groupId: string;
  examId: string;
  sessionId: string;
}

function MCQInput({ question, answer, onAnswer }: InputProps) {
  const opts = getOptionsArray(question.options);
  return (
    <div className="space-y-2">
      {opts.map((opt, idx) => {
        const letter = ["A", "B", "C", "D"][idx] ?? String(idx + 1);
        const selected = answer === letter;
        return (
          <button
            type="button"
            key={idx}
            onClick={() => onAnswer(question.id, letter)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all",
              selected
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-slate-700"
            )}
          >
            <span
              className={cn(
                "w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold",
                selected ? "border-primary bg-primary text-white" : "border-slate-300 text-slate-500"
              )}
            >
              {letter}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MCQMultipleInput({ question, answer, onAnswer }: InputProps) {
  const opts = getOptionsArray(question.options);
  const selected = answer ? answer.split(",").filter(Boolean) : [];

  const toggle = (letter: string) => {
    const next = selected.includes(letter)
      ? selected.filter((l) => l !== letter)
      : [...selected, letter];
    onAnswer(question.id, next.join(","));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3">Select all that apply</p>
      {opts.map((opt, idx) => {
        const letter = ["A", "B", "C", "D"][idx] ?? String(idx + 1);
        const isSelected = selected.includes(letter);
        return (
          <button
            type="button"
            key={idx}
            onClick={() => toggle(letter)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all",
              isSelected
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-slate-200 hover:border-primary/40 hover:bg-slate-50 text-slate-700"
            )}
          >
            <span
              className={cn(
                "w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center text-xs",
                isSelected ? "border-primary bg-primary text-white" : "border-slate-300"
              )}
            >
              {isSelected && "✓"}
            </span>
            <span className="font-semibold mr-0.5">{letter}.</span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseInput({ question, answer, onAnswer }: InputProps) {
  if (question.options) return <MCQInput question={question} answer={answer} onAnswer={onAnswer} />;
  return (
    <div className="flex gap-3">
      {["True", "False"].map((val) => (
        <button
          type="button"
          key={val}
          onClick={() => onAnswer(question.id, val)}
          className={cn(
            "flex-1 py-3 rounded-xl border text-sm font-medium transition-all",
            answer === val
              ? "border-primary bg-primary/5 text-primary"
              : "border-slate-200 hover:border-primary/40 text-slate-700"
          )}
        >
          {val}
        </button>
      ))}
    </div>
  );
}

function FillBlankInput({ question, answer, onAnswer }: InputProps) {
  return (
    <input
      type="text"
      value={answer ?? ""}
      onChange={(e) => onAnswer(question.id, e.target.value)}
      placeholder="Type your answer…"
      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-indigo-500/20"
    />
  );
}

function OpenCalculationInput({ question, answer, onAnswer }: InputProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Show your working steps and state your final answer.</p>
      <textarea
        value={answer ?? ""}
        onChange={(e) => onAnswer(question.id, e.target.value)}
        placeholder={"Step 1: …\nStep 2: …\nFinal answer: …"}
        rows={8}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-indigo-500/20 resize-y font-mono"
      />
    </div>
  );
}

function EssayInput({ question, answer, onAnswer }: InputProps) {
  const words = (answer ?? "").trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-2">
      <textarea
        value={answer ?? ""}
        onChange={(e) => onAnswer(question.id, e.target.value)}
        placeholder="Write your essay response here…"
        rows={12}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-indigo-500/20 resize-y"
      />
      <p className="text-xs text-slate-400 text-right">
        {words} word{words !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function DocumentAnalysisInput({ question, answer, onAnswer }: InputProps) {
  let subAnswers: Record<string, string> = {};
  try {
    if (answer) subAnswers = JSON.parse(answer);
  } catch {
    subAnswers = answer ? { "0": answer } : {};
  }

  const q = question as unknown as Record<string, unknown>;
  const subQuestions: Array<{ question: string }> = Array.isArray(q.sub_questions)
    ? (q.sub_questions as Array<{ question: string }>)
    : [];

  const updateSub = (idx: number, val: string) => {
    const next = { ...subAnswers, [String(idx)]: val };
    onAnswer(question.id, JSON.stringify(next));
  };

  if (subQuestions.length === 0) {
    return (
      <textarea
        value={answer ?? ""}
        onChange={(e) => onAnswer(question.id, e.target.value)}
        placeholder="Write your analysis here…"
        rows={8}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-indigo-500/20 resize-y"
      />
    );
  }

  return (
    <div className="space-y-4">
      {subQuestions.map((sq, idx) => (
        <div key={idx}>
          <p className="text-sm font-medium text-slate-700 mb-1.5">
            {idx + 1}. {sq.question}
          </p>
          <textarea
            value={subAnswers[String(idx)] ?? ""}
            onChange={(e) => updateSub(idx, e.target.value)}
            placeholder="Your answer…"
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-indigo-500/20 resize-y"
          />
        </div>
      ))}
    </div>
  );
}

function ConstructionPhotoInput({
  question,
  answer,
  onAnswer,
  groupId,
  examId,
  sessionId,
}: InputProps & { groupId: string; examId: string; sessionId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { mutate: upload, isPending } = useUploadConstructionPhoto(groupId, examId, sessionId);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    upload(
      { questionId: question.id, file },
      { onSuccess: () => onAnswer(question.id, "__uploaded__") }
    );
  };

  const uploaded = answer === "__uploaded__" || !!preview;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Upload a photo of your geometric construction.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Your construction"
            className="rounded-xl border border-slate-200 max-h-64 object-contain w-full"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onAnswer(question.id, "");
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="absolute top-2 right-2 p-1 bg-white rounded-full border border-slate-200 shadow-sm hover:bg-slate-50"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          className="w-full border-2 border-dashed border-slate-300 rounded-xl py-10 flex flex-col items-center gap-2 text-slate-500 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <Camera size={24} />
          )}
          <span className="text-sm">
            {isPending ? "Uploading…" : "Take photo or browse"}
          </span>
        </button>
      )}
      {uploaded && !isPending && (
        <p className="text-xs text-emerald-600 flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-emerald-100 inline-flex items-center justify-center font-bold">✓</span>
          Photo uploaded
        </p>
      )}
    </div>
  );
}

export function QuestionRenderer({
  question,
  answer,
  onAnswer,
  groupId,
  examId,
  sessionId,
}: RendererProps) {
  switch (question.type) {
    case "mcq_single":
      return <MCQInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "mcq_multiple":
      return <MCQMultipleInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "true_false":
      return <TrueFalseInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "fill_blank":
      return <FillBlankInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "open_calculation":
      return <OpenCalculationInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "essay":
      return <EssayInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "document_analysis":
      return <DocumentAnalysisInput question={question} answer={answer} onAnswer={onAnswer} />;
    case "construction_photo":
      return (
        <ConstructionPhotoInput
          question={question}
          answer={answer}
          onAnswer={onAnswer}
          groupId={groupId}
          examId={examId}
          sessionId={sessionId}
        />
      );
    default:
      return null;
  }
}
