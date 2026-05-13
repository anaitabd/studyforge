"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Loader2,
  Download,
  AlertTriangle,
  BookOpen,
  Quote,
  FlaskConical,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  useSlideDeck,
  useUpdateSlideProgress,
  getDeckPptxUrl,
  type Slide,
} from "@/lib/hooks/use-slides";
import { SlideViewer } from "@/components/slides/slide-viewer";
import { cn } from "@/lib/utils";

export default function SlideDeckPage({
  params,
}: {
  params: Promise<{ groupId: string; deckId: string }>;
}) {
  const { groupId, deckId } = use(params);
  const { data: deck, isLoading, error } = useSlideDeck(groupId, deckId);
  const updateProgress = useUpdateSlideProgress(groupId, deckId);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (deck?.my_progress) {
      setActiveIndex(
        Math.min(deck.my_progress.current_slide_index, Math.max(0, deck.slide_count - 1))
      );
    }
  }, [deck?.id, deck?.my_progress?.current_slide_index, deck?.slide_count, deck?.my_progress]);

  const slides = useMemo(() => deck?.slides ?? [], [deck?.slides]);
  const currentSlide: Slide | undefined = slides[activeIndex];

  const completedSet = useMemo(
    () => new Set(deck?.my_progress.completed_slide_ids ?? []),
    [deck?.my_progress.completed_slide_ids]
  );

  const completedCount = completedSet.size;
  const total = deck?.slide_count ?? 0;
  const overallPct = total ? Math.round((100 * completedCount) / total) : 0;

  const isQuizGated = currentSlide?.quiz && !deck?.my_quiz_answers[currentSlide.id];

  function goTo(i: number) {
    if (i < 0 || i >= slides.length) return;
    if (i > activeIndex + 1 && !slides.slice(activeIndex, i).every((s) => completedSet.has(s.id))) {
      // prevent jumping ahead past unviewed slides
      return;
    }
    setActiveIndex(i);
    updateProgress.mutate({ current_slide_index: i });
  }

  function next() {
    if (!currentSlide) return;
    if (isQuizGated) return;
    const nextIdx = activeIndex + 1;
    updateProgress.mutate({
      current_slide_index: Math.min(nextIdx, slides.length - 1),
      mark_slide_completed_id: currentSlide.id,
    });
    if (nextIdx < slides.length) setActiveIndex(nextIdx);
  }

  function prev() {
    if (activeIndex <= 0) return;
    const prevIdx = activeIndex - 1;
    setActiveIndex(prevIdx);
    updateProgress.mutate({ current_slide_index: prevIdx });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Couldn&apos;t load this deck. Try refreshing.
      </div>
    );
  }

  if (deck.status === "generating") {
    return (
      <div className="space-y-4">
        <Link
          href={`/groups/${groupId}/slides`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={14} /> Back to slides
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Loader2 className="mx-auto mb-3 animate-spin text-accent" size={28} />
          <p className="font-medium text-primary">Generating your deck…</p>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;re reading your files, designing the outline, and writing per-slide
            explanations and quizzes. This usually takes 60–120 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (deck.status === "error") {
    return (
      <div className="space-y-4">
        <Link
          href={`/groups/${groupId}/slides`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={14} /> Back to slides
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} /> Generation failed
          </div>
          <p>{deck.error_message || "Something went wrong. Try generating again."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/groups/${groupId}/slides`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary"
        >
          <ArrowLeft size={14} /> Back to slides
        </Link>
        <a
          href={deck.pptx_url ?? getDeckPptxUrl(groupId, deckId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-accent hover:text-accent"
        >
          <Download size={12} /> Download PPTX
        </a>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-primary/5 via-white to-accent/5 p-6 shadow-sm">
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            {deck.course_name && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {deck.course_name}
              </p>
            )}
            <h2 className="font-sora text-xl font-bold text-primary">{deck.title}</h2>
            {deck.professor_name && (
              <p className="mt-0.5 text-xs text-slate-500">{deck.professor_name}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{completedCount} / {total} done</p>
            <p className="font-sora text-2xl font-bold text-primary">{overallPct}%</p>
          </div>
        </div>
        <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              overallPct === 100 ? "bg-emerald-500" : "bg-accent"
            )}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[80vh] lg:overflow-y-auto">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Outline
          </p>
          <ol className="space-y-0.5">
            {slides.map((s, i) => {
              const isActive = i === activeIndex;
              const isCompleted = completedSet.has(s.id);
              const isLocked =
                i > activeIndex + 1 &&
                !slides.slice(activeIndex, i).every((sl) => completedSet.has(sl.id));
              const isSection = s.slide_type === "section" || s.slide_type === "title";
              const TypeIcon = SLIDE_TYPE_ICON[s.slide_type] ?? BookOpen;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    disabled={isLocked}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      isActive && "bg-accent/10 text-accent font-medium",
                      !isActive && "text-slate-600 hover:bg-slate-50",
                      isSection && !isActive && "font-semibold text-primary",
                      !isSection && "pl-4",
                      isLocked && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]">
                      {isActive && (
                        <span className="absolute -left-2.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-accent" />
                      )}
                      {isCompleted ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : isLocked ? (
                        <Lock size={11} className="text-slate-400" />
                      ) : (
                        <TypeIcon
                          size={12}
                          className={isActive ? "text-accent" : "text-slate-400"}
                        />
                      )}
                    </span>
                    <span className="line-clamp-1 flex-1">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="min-w-0">
          {currentSlide ? (
            <SlideViewer groupId={groupId} deck={deck} slide={currentSlide} />
          ) : (
            <p className="text-sm text-slate-500">No slides in this deck.</p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={prev}
              disabled={activeIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600"
            >
              <ArrowLeft size={14} /> Previous
            </button>
            <p className="text-xs text-slate-400">
              {activeIndex + 1} / {slides.length}
            </p>
            <button
              type="button"
              onClick={next}
              disabled={activeIndex >= slides.length - 1 || !!isQuizGated}
              title={isQuizGated ? "Answer the quiz on this slide first" : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

const SLIDE_TYPE_ICON: Record<string, LucideIcon> = {
  title: Sparkles,
  section: BookOpen,
  content: BookOpen,
  definition: Quote,
  example: FlaskConical,
  quiz: ListChecks,
  summary: ListChecks,
};
