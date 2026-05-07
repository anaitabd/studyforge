"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  BookOpen,
  FlaskConical,
  Sparkles,
  CheckCircle2,
  ListChecks,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Slide, type SlideDeckDetail } from "@/lib/hooks/use-slides";
import { SlideQuiz } from "./slide-quiz";

const PROSE_CLASSES =
  "prose prose-slate max-w-none prose-headings:font-sora prose-headings:text-primary prose-headings:mt-5 prose-headings:mb-2 prose-h2:text-base prose-h2:font-semibold prose-h3:text-sm prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-accent prose-strong:text-primary prose-code:text-accent prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-table:text-sm prose-th:bg-slate-50 prose-th:text-primary prose-th:font-semibold prose-li:my-0.5";

export function SlideViewer({
  groupId,
  deck,
  slide,
  onQuizAnswered,
}: {
  groupId: string;
  deck: SlideDeckDetail;
  slide: Slide;
  onQuizAnswered?: () => void;
}) {
  const priorAnswer = deck.my_quiz_answers[slide.id];

  switch (slide.slide_type) {
    case "title":
      return <TitleSlide deck={deck} slide={slide} />;
    case "section":
      return <SectionSlide slide={slide} />;
    case "definition":
      return (
        <BaseSlide deck={deck} slide={slide} priorAnswer={priorAnswer} groupId={groupId} onQuizAnswered={onQuizAnswered}>
          <DefinitionBody slide={slide} />
        </BaseSlide>
      );
    case "example":
      return (
        <BaseSlide deck={deck} slide={slide} priorAnswer={priorAnswer} groupId={groupId} onQuizAnswered={onQuizAnswered}>
          <ExampleBody slide={slide} />
        </BaseSlide>
      );
    case "summary":
      return (
        <BaseSlide deck={deck} slide={slide} priorAnswer={priorAnswer} groupId={groupId} onQuizAnswered={onQuizAnswered}>
          <SummaryBody slide={slide} />
        </BaseSlide>
      );
    default:
      return (
        <BaseSlide deck={deck} slide={slide} priorAnswer={priorAnswer} groupId={groupId} onQuizAnswered={onQuizAnswered}>
          <ContentBody slide={slide} />
        </BaseSlide>
      );
  }
}

// ── Title / Section heroes ────────────────────────────────────────────────────

function TitleSlide({ deck, slide }: { deck: SlideDeckDetail; slide: Slide }) {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-start justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-12 text-white shadow-lg">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      <p className="relative mb-3 text-xs font-bold uppercase tracking-[0.25em] text-white/60">Course</p>
      <h1 className="relative font-sora text-5xl font-bold leading-tight">{slide.title}</h1>
      {slide.detailed_explanation && (
        <p className="relative mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
          {slide.detailed_explanation}
        </p>
      )}
      {(deck.course_name || deck.professor_name) && (
        <p className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm">
          {deck.course_name}
          {deck.professor_name && <span className="text-white/40">·</span>}
          {deck.professor_name}
        </p>
      )}
    </div>
  );
}

function SectionSlide({ slide }: { slide: Slide }) {
  return (
    <div className="relative flex min-h-[40vh] items-center overflow-hidden rounded-2xl bg-accent p-12 text-white shadow-lg">
      <div className="absolute left-0 top-0 h-full w-2 bg-primary" />
      <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-white/60">Section</p>
        <h1 className="font-sora text-4xl font-bold leading-tight">{slide.title}</h1>
      </div>
    </div>
  );
}

// ── Shared chrome ─────────────────────────────────────────────────────────────

function BaseSlide({
  groupId,
  deck,
  slide,
  priorAnswer,
  onQuizAnswered,
  children,
}: {
  groupId: string;
  deck: SlideDeckDetail;
  slide: Slide;
  priorAnswer?: { selected_index: number; is_correct: boolean };
  onQuizAnswered?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-7">
      <SlideHeader deck={deck} slide={slide} />
      {children}
      {slide.quiz && (
        <>
          <Divider />
          <SlideQuiz
            groupId={groupId}
            deckId={deck.id}
            slide={slide}
            priorAnswer={priorAnswer}
            onAnswered={onQuizAnswered}
          />
        </>
      )}
      <SourceFooter slide={slide} />
    </div>
  );
}

function SlideHeader({ deck, slide }: { deck: SlideDeckDetail; slide: Slide }) {
  const meta = SLIDE_TYPE_META[slide.slide_type] ?? SLIDE_TYPE_META.content;
  const Icon = meta.icon;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
          <Icon size={12} className={meta.iconColor} />
          {meta.label}
        </div>
        <h1 className="font-sora text-3xl font-bold leading-tight text-primary">
          {slide.title}
        </h1>
      </div>
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono text-slate-500">
        {String(slide.order_index + 1).padStart(2, "0")}
        <span className="text-slate-300"> / </span>
        {String(deck.slide_count).padStart(2, "0")}
      </div>
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-200" />;
}

function SourceFooter({ slide }: { slide: Slide }) {
  if (!slide.source_file && (slide.source_pages?.length ?? 0) === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
      {slide.source_file && (
        <span className="inline-flex items-center gap-1">
          <FileText size={12} />
          {slide.source_file}
        </span>
      )}
      {(slide.source_pages ?? []).map((p) => (
        <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
          p.{p}
        </span>
      ))}
    </div>
  );
}

// ── Body variants ─────────────────────────────────────────────────────────────

function ContentBody({ slide }: { slide: Slide }) {
  return (
    <>
      {slide.bullets.length > 0 && <BulletGrid bullets={slide.bullets} />}
      {slide.detailed_explanation && (
        <DeepDive markdown={slide.detailed_explanation} />
      )}
      {slide.examples.length > 0 && <ExamplesBlock examples={slide.examples} />}
      <SpeakerNotes notes={slide.speaker_notes} />
    </>
  );
}

function DefinitionBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 via-white to-white p-7 shadow-sm">
        <p className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
          <Quote size={11} /> Definition
        </p>
        <h2 className="mb-4 font-sora text-2xl font-semibold leading-snug text-primary">
          {slide.title}
        </h2>
        {slide.bullets.length > 0 && (
          <ul className="space-y-2 border-l-2 border-accent/30 pl-4">
            {slide.bullets.map((b, i) => (
              <li key={i} className="text-base leading-relaxed text-slate-800">
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
      {slide.detailed_explanation && (
        <DeepDive markdown={slide.detailed_explanation} />
      )}
      {slide.examples.length > 0 && <ExamplesBlock examples={slide.examples} />}
      <SpeakerNotes notes={slide.speaker_notes} />
    </>
  );
}

function ExampleBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="rounded-2xl border border-amber/20 bg-gradient-to-br from-amber/5 via-white to-white p-7 shadow-sm">
        <p className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber">
          <FlaskConical size={11} /> Worked example
        </p>
        {slide.bullets.length > 0 && <BulletGrid bullets={slide.bullets} compact />}
        {slide.detailed_explanation && (
          <div className="mt-5 border-t border-amber/15 pt-5">
            <div className={PROSE_CLASSES}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {slide.detailed_explanation}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
      {slide.examples.length > 0 && <ExamplesBlock examples={slide.examples} />}
      <SpeakerNotes notes={slide.speaker_notes} />
    </>
  );
}

function SummaryBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="rounded-2xl border border-teal/20 bg-gradient-to-br from-teal/5 via-white to-white p-7 shadow-sm">
        <p className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal">
          <ListChecks size={11} /> What to remember
        </p>
        {slide.bullets.length > 0 ? (
          <ul className="space-y-3">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-teal"
                />
                <span className="text-base leading-relaxed text-slate-800">{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No takeaways.</p>
        )}
      </div>
      {slide.detailed_explanation && (
        <DeepDive markdown={slide.detailed_explanation} />
      )}
      <SpeakerNotes notes={slide.speaker_notes} />
    </>
  );
}

// ── Reusable blocks ───────────────────────────────────────────────────────────

function BulletGrid({ bullets, compact = false }: { bullets: string[]; compact?: boolean }) {
  return (
    <ul
      className={cn(
        "grid gap-2.5",
        bullets.length >= 4 && !compact && "sm:grid-cols-2 sm:gap-3"
      )}
    >
      {bullets.map((b, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed text-slate-800">{b}</span>
        </li>
      ))}
    </ul>
  );
}

function DeepDive({ markdown }: { markdown: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border-t-4 border-accent bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <BookOpen size={14} className="text-accent" /> Deep dive
      </div>
      <div className="px-6 py-5">
        <div className={PROSE_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function ExamplesBlock({
  examples,
}: {
  examples: { title: string; body: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <Sparkles size={12} className="text-amber" /> Examples
      </p>
      {examples.map((ex, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 bg-amber/5 px-5 py-2.5">
            <p className="text-sm font-semibold text-primary">{ex.title}</p>
          </div>
          <div className="px-5 py-4">
            <div className={PROSE_CLASSES}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{ex.body}</ReactMarkdown>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeakerNotes({ notes }: { notes: string }) {
  const [open, setOpen] = useState(false);
  if (!notes) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <span className="inline-flex items-center gap-1.5">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Speaker notes
        </span>
        <span className="text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {notes}
        </div>
      )}
    </div>
  );
}

// ── slide-type metadata ───────────────────────────────────────────────────────

const SLIDE_TYPE_META: Record<
  string,
  { label: string; icon: LucideIcon; iconColor: string }
> = {
  title: { label: "Title", icon: Sparkles, iconColor: "text-accent" },
  section: { label: "Section", icon: BookOpen, iconColor: "text-accent" },
  content: { label: "Content", icon: BookOpen, iconColor: "text-accent" },
  definition: { label: "Definition", icon: Quote, iconColor: "text-accent" },
  example: { label: "Example", icon: FlaskConical, iconColor: "text-amber" },
  quiz: { label: "Check", icon: ListChecks, iconColor: "text-teal" },
  summary: { label: "Summary", icon: ListChecks, iconColor: "text-teal" },
};
