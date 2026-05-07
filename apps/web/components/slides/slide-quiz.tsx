"use client";

import { useState, useEffect } from "react";
import { Check, X as XIcon, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnswerSlideQuiz, type Slide } from "@/lib/hooks/use-slides";

interface PriorAnswer {
  selected_index: number;
  is_correct: boolean;
}

export function SlideQuiz({
  groupId,
  deckId,
  slide,
  priorAnswer,
  onAnswered,
}: {
  groupId: string;
  deckId: string;
  slide: Slide;
  priorAnswer?: PriorAnswer;
  onAnswered?: () => void;
}) {
  const answer = useAnswerSlideQuiz(groupId, deckId);
  const [selected, setSelected] = useState<number | null>(priorAnswer?.selected_index ?? null);
  const [result, setResult] = useState<{
    is_correct: boolean;
    correct_index: number;
    rationale: string;
  } | null>(
    priorAnswer
      ? {
          is_correct: priorAnswer.is_correct,
          correct_index: slide.quiz?.correct_index ?? -1,
          rationale: slide.quiz?.rationale ?? "",
        }
      : null
  );

  useEffect(() => {
    setSelected(priorAnswer?.selected_index ?? null);
    if (priorAnswer && slide.quiz?.correct_index !== undefined) {
      setResult({
        is_correct: priorAnswer.is_correct,
        correct_index: slide.quiz.correct_index,
        rationale: slide.quiz.rationale ?? "",
      });
    } else {
      setResult(null);
    }
  }, [slide.id, priorAnswer?.selected_index, slide.quiz?.correct_index, priorAnswer?.is_correct, slide.quiz?.rationale, priorAnswer]);

  if (!slide.quiz) return null;
  const locked = result !== null || answer.isPending;

  function submit() {
    if (selected === null) return;
    answer.mutate(
      { slideId: slide.id, selected_index: selected },
      {
        onSuccess: (res) => {
          setResult(res);
          onAnswered?.();
        },
      }
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <HelpCircle size={14} /> Check your understanding
      </div>
      <p className="mb-4 font-medium text-slate-800">{slide.quiz.question}</p>
      <div className="space-y-2">
        {slide.quiz.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = result && i === result.correct_index;
          const isWrongPick = result && isSelected && !result.is_correct;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                !result && isSelected && "border-accent bg-accent/5",
                !result && !isSelected && "border-slate-200 hover:border-slate-300 bg-white",
                isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-900",
                isWrongPick && "border-red-400 bg-red-50 text-red-900",
                result && !isCorrect && !isWrongPick && "border-slate-200 bg-white opacity-60",
                locked && "cursor-not-allowed"
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {isCorrect && <Check size={14} className="text-emerald-600" />}
              {isWrongPick && <XIcon size={14} className="text-red-600" />}
            </button>
          );
        })}
      </div>

      {!result && (
        <button
          type="button"
          disabled={selected === null || answer.isPending}
          onClick={submit}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Submit answer
        </button>
      )}

      {result && (
        <div
          className={cn(
            "mt-4 rounded-lg border px-4 py-3 text-sm",
            result.is_correct
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}
        >
          <p className="font-semibold">
            {result.is_correct ? "Correct!" : "Not quite."}
          </p>
          {result.rationale && <p className="mt-1 text-xs">{result.rationale}</p>}
        </div>
      )}
    </div>
  );
}
