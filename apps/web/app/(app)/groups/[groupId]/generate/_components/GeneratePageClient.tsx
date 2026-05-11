"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  GraduationCap, BookOpen, Map, Presentation,
  FileText, File as FileIcon, X, CheckSquare,
  Square, ChevronDown, ChevronUp, ArrowRight,
  AlertTriangle, CheckCircle2, Loader2, Download,
  Sparkles,
} from "lucide-react";
import { useGroups } from "@/lib/hooks/useApi";
import { cn } from "@/lib/utils";
import {
  useGroupFilesForGenerate,
  useGenerateExam,
  useGenerateFlashcards,
  useGeneratePath,
  useGenerateSlides,
  usePollSlideDeck,
  useGenerationHistory,
  type GroupFile,
  type HistoryItem,
} from "@/hooks/use-generate";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function autoTitle(prefix: string, files: GroupFile[], ids: string[]) {
  if (!ids.length) return "";
  const first = files.find((f) => f.id === ids[0]);
  return first ? `${prefix} — ${first.name.replace(/\.[^.]+$/, "")}` : prefix;
}

const FILE_ICON_CLASS: Record<string, string> = {
  pdf: "text-red-500",
  docx: "text-blue-500",
  pptx: "text-orange-500",
  txt: "text-slate-400",
  file: "text-slate-400",
};

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-primary tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

// ─── Job status card ──────────────────────────────────────────────────────────

function JobCard({
  status, resultUrl, resultLabel, extraAction, onRetry, errorMsg,
}: {
  status: "processing" | "ready" | "error";
  resultUrl?: string;
  resultLabel?: string;
  extraAction?: React.ReactNode;
  onRetry?: () => void;
  errorMsg?: string | null;
}) {
  if (status === "processing") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Loader2 size={18} className="text-accent animate-spin shrink-0" />
        <div>
          <p className="text-sm font-medium text-slate-700">Generating…</p>
          <p className="text-[11px] text-slate-400 mt-0.5">This may take a minute. Stay on this page.</p>
        </div>
      </div>
    );
  }
  if (status === "ready") {
    return (
      <div className="mt-3 rounded-xl border border-teal/30 bg-teal/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-teal shrink-0" />
          <p className="text-sm font-medium text-teal">Ready!</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resultUrl && (
            <Link
              href={resultUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal text-white text-xs font-medium hover:bg-teal/90"
            >
              {resultLabel ?? "View result"} <ArrowRight size={12} />
            </Link>
          )}
          {extraAction}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-destructive shrink-0" />
        <p className="text-sm font-medium text-destructive">
          {errorMsg ?? "Generation failed"}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-destructive underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Generation cards ─────────────────────────────────────────────────────────

type CardKey = "exam" | "flashcards" | "path" | "slides";

const CARD_META: Record<CardKey, {
  label: string; icon: React.ElementType; borderColor: string; iconColor: string;
}> = {
  exam:       { label: "Exam",          icon: GraduationCap, borderColor: "border-l-accent",       iconColor: "text-accent" },
  flashcards: { label: "Flashcards",    icon: BookOpen,      borderColor: "border-l-teal",         iconColor: "text-teal" },
  path:       { label: "Learning path", icon: Map,           borderColor: "border-l-purple-500",   iconColor: "text-purple-500" },
  slides:     { label: "Slides",        icon: Presentation,  borderColor: "border-l-amber",        iconColor: "text-amber" },
};

function CardHeader({
  cardKey, expanded, onToggle, inFlight,
}: {
  cardKey: CardKey; expanded: boolean; onToggle: () => void; inFlight: boolean;
}) {
  const { label, icon: Icon, borderColor, iconColor } = CARD_META[cardKey];
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between gap-3 p-4 border-l-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition",
        borderColor,
        expanded && "rounded-b-none border-b-0"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className={iconColor} />
        <span className="font-sora font-semibold text-primary text-sm">{label}</span>
      </div>
      {inFlight
        ? <Loader2 size={15} className="text-slate-400 animate-spin" />
        : expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />
      }
    </button>
  );
}

// Exam card
function ExamCard({
  groupId, selectedFiles, allFiles, expanded, onToggle, inFlight, onStart, onEnd,
}: CardProps) {
  const [title, setTitle] = useState("");
  const [qCount, setQCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [qType, setQType] = useState("mcq_single");
  const [jobState, setJobState] = useState<{ status: "processing" | "ready" | "error"; id?: string; error?: string } | null>(null);
  const { mutate, isPending } = useGenerateExam(groupId);

  useEffect(() => {
    if (!title && selectedFiles.length > 0)
      setTitle(autoTitle("Exam", allFiles, selectedFiles));
  }, [selectedFiles, allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = selectedFiles.length > 0 && !inFlight && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart();
    setJobState({ status: "processing" });
    mutate(
      { title: title || "Untitled exam", file_ids: selectedFiles, question_count: qCount, difficulty, question_type: qType as never },
      {
        onSuccess: (res: any) => {
          const id = res?.id ?? res?.exam_id;
          setJobState({ status: "ready", id });
          onEnd();
        },
        onError: (err: any) => {
          setJobState({ status: "error", error: err.message });
          toast.error(err.message ?? "Exam generation failed");
          onEnd();
        },
      }
    );
  };

  return (
    <div>
      <CardHeader cardKey="exam" expanded={expanded} onToggle={onToggle} inFlight={isPending} />
      {expanded && (
        <div className={cn("border border-t-0 border-l-4 border-l-accent border-slate-200 rounded-b-xl bg-white p-5 space-y-4")}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title" />
          </div>
          <Slider label="Questions" value={qCount} min={5} max={50} onChange={setQCount} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Difficulty</label>
            <div className="flex gap-1.5 flex-wrap">
              {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition capitalize",
                    difficulty === d ? "bg-accent text-white border-accent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Question type</label>
            <select className="input w-full" value={qType} onChange={(e) => setQType(e.target.value)}>
              <option value="mcq_single">Multiple choice (single answer)</option>
              <option value="mcq_multiple">Multiple choice (multiple answers)</option>
              <option value="true_false">True / False</option>
              <option value="fill_blank">Fill in the blank</option>
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Generating…" : "Generate exam"}
          </button>
          {jobState && (
            <JobCard
              status={jobState.status}
              resultUrl={jobState.id ? `/groups/${groupId}/exams/${jobState.id}` : undefined}
              resultLabel="View exam"
              errorMsg={jobState.error}
              onRetry={jobState.status === "error" ? () => setJobState(null) : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Flashcards card
function FlashcardsCard({ groupId, selectedFiles, allFiles, expanded, onToggle, inFlight, onStart, onEnd }: CardProps) {
  const [title, setTitle] = useState("");
  const [cardCount, setCardCount] = useState(40);
  const [jobState, setJobState] = useState<{ status: "processing" | "ready" | "error"; id?: string; error?: string } | null>(null);
  const { mutate, isPending } = useGenerateFlashcards(groupId);

  useEffect(() => {
    if (!title && selectedFiles.length > 0)
      setTitle(autoTitle("Flashcards", allFiles, selectedFiles));
  }, [selectedFiles, allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = selectedFiles.length > 0 && !inFlight && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart();
    setJobState({ status: "processing" });
    mutate(
      { title: title || "Untitled set", file_ids: selectedFiles, max_cards: cardCount },
      {
        onSuccess: (res: any) => {
          setJobState({ status: "ready", id: res?.id ?? res?.set_id });
          onEnd();
        },
        onError: (err: any) => {
          setJobState({ status: "error", error: err.message });
          toast.error(err.message ?? "Flashcard generation failed");
          onEnd();
        },
      }
    );
  };

  return (
    <div>
      <CardHeader cardKey="flashcards" expanded={expanded} onToggle={onToggle} inFlight={isPending} />
      {expanded && (
        <div className="border border-t-0 border-l-4 border-l-teal border-slate-200 rounded-b-xl bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flashcard set title" />
          </div>
          <Slider label="Number of cards" value={cardCount} min={10} max={100} onChange={setCardCount} />
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-lg bg-teal text-white text-sm font-medium hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Generating…" : "Generate flashcards"}
          </button>
          {jobState && (
            <JobCard
              status={jobState.status}
              resultUrl={jobState.id ? `/groups/${groupId}/flashcards/${jobState.id}` : undefined}
              resultLabel="Study flashcards"
              errorMsg={jobState.error}
              onRetry={jobState.status === "error" ? () => setJobState(null) : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Learning path card
function PathCard({ groupId, selectedFiles, allFiles, expanded, onToggle, inFlight, onStart, onEnd }: CardProps) {
  const [title, setTitle] = useState("");
  const [moduleCount, setModuleCount] = useState(6);
  const [jobState, setJobState] = useState<{ status: "processing" | "ready" | "error"; id?: string; error?: string } | null>(null);
  const { mutate, isPending } = useGeneratePath(groupId);

  useEffect(() => {
    if (!title && selectedFiles.length > 0)
      setTitle(autoTitle("Learning path", allFiles, selectedFiles));
  }, [selectedFiles, allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = selectedFiles.length > 0 && !inFlight && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart();
    setJobState({ status: "processing" });
    mutate(
      { title: title || "Untitled path", file_ids: selectedFiles, module_count: moduleCount },
      {
        onSuccess: (res: any) => {
          setJobState({ status: "ready", id: res?.id ?? res?.path_id });
          onEnd();
        },
        onError: (err: any) => {
          setJobState({ status: "error", error: err.message });
          toast.error(err.message ?? "Path generation failed");
          onEnd();
        },
      }
    );
  };

  return (
    <div>
      <CardHeader cardKey="path" expanded={expanded} onToggle={onToggle} inFlight={isPending} />
      {expanded && (
        <div className="border border-t-0 border-l-4 border-l-purple-500 border-slate-200 rounded-b-xl bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Learning path title" />
          </div>
          <Slider label="Modules" value={moduleCount} min={3} max={12} onChange={setModuleCount} />
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Generating…" : "Generate path"}
          </button>
          {jobState && (
            <JobCard
              status={jobState.status}
              resultUrl={jobState.id ? `/groups/${groupId}/learning-paths/${jobState.id}` : undefined}
              resultLabel="View learning path"
              errorMsg={jobState.error}
              onRetry={jobState.status === "error" ? () => setJobState(null) : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Slides card — truly async (Celery), needs polling
function SlidesCard({ groupId, selectedFiles, allFiles, expanded, onToggle, inFlight, onStart, onEnd }: CardProps) {
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("academic");
  const [language, setLanguage] = useState("en");
  const [deckId, setDeckId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mutate, isPending } = useGenerateSlides(groupId);
  const poll = usePollSlideDeck(groupId, deckId);

  useEffect(() => {
    if (!title && selectedFiles.length > 0)
      setTitle(autoTitle("Slides", allFiles, selectedFiles));
  }, [selectedFiles, allFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release inFlight lock when polling resolves
  useEffect(() => {
    if (poll.data?.status === "ready" || poll.data?.status === "error") {
      onEnd();
    }
  }, [poll.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = selectedFiles.length > 0 && !inFlight && !isPending && !deckId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(null);
    onStart();
    mutate(
      { title: title || "Untitled slides", file_ids: selectedFiles, style, language },
      {
        onSuccess: (res) => setDeckId(res.id),
        onError: (err: any) => {
          setSubmitError(err.message ?? "Slides generation failed");
          toast.error(err.message ?? "Slides generation failed");
          onEnd();
        },
      }
    );
  };

  const deckStatus = poll.data?.status;
  const jobStatus =
    submitError ? "error" :
    deckStatus === "ready" ? "ready" :
    deckStatus === "error" ? "error" :
    deckId ? "processing" : null;

  return (
    <div>
      <CardHeader cardKey="slides" expanded={expanded} onToggle={onToggle} inFlight={isPending || deckStatus === "generating"} />
      {expanded && (
        <div className="border border-t-0 border-l-4 border-l-amber border-slate-200 rounded-b-xl bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Slide deck title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Style</label>
              <select className="input w-full" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="academic">Academic</option>
                <option value="minimal">Minimal</option>
                <option value="vibrant">Vibrant</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <select className="input w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-lg bg-amber text-white text-sm font-medium hover:bg-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Queuing…" : "Generate slides"}
          </button>
          {jobStatus && (
            <JobCard
              status={jobStatus}
              resultUrl={deckId ? `/groups/${groupId}/slides/${deckId}` : undefined}
              resultLabel="View slides"
              errorMsg={submitError ?? poll.data?.error_message}
              onRetry={jobStatus === "error" ? () => { setDeckId(null); setSubmitError(null); } : undefined}
              extraAction={
                jobStatus === "ready" && poll.data?.pptx_url ? (
                  <a
                    href={poll.data.pptx_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal text-teal text-xs font-medium hover:bg-teal/5"
                  >
                    <Download size={12} /> Download PPTX
                  </a>
                ) : null
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  groupId: string;
  selectedFiles: string[];
  allFiles: GroupFile[];
  expanded: boolean;
  onToggle: () => void;
  inFlight: boolean;
  onStart: () => void;
  onEnd: () => void;
}

// ─── File selector ────────────────────────────────────────────────────────────

function FileSelector({
  files,
  isLoading,
  selectedFiles,
  onToggle,
  onSelectAll,
  onDeselectAll,
  groupId,
}: {
  files: GroupFile[];
  isLoading: boolean;
  selectedFiles: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  groupId: string;
}) {
  const readyFiles = files.filter((f) => f.status === "ready");
  const processingFiles = files.filter((f) =>
    f.status === "uploading" || f.status === "processing"
  );
  const totalChunks = readyFiles
    .filter((f) => selectedFiles.includes(f.id))
    .reduce((s, f) => s + (f.chunk_count ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-sora text-sm font-semibold text-primary">Source files</h2>
        <div className="flex gap-2 text-[11px]">
          <button onClick={onSelectAll} className="text-accent hover:underline">All</button>
          <span className="text-slate-300">·</span>
          <button onClick={onDeselectAll} className="text-slate-500 hover:underline">None</button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : readyFiles.length === 0 && processingFiles.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          No ready files.{" "}
          <Link href={`/groups/${groupId}`} className="text-accent hover:underline">
            Upload files first →
          </Link>
        </div>
      ) : (
        <div className="space-y-1 flex-1 overflow-y-auto">
          {readyFiles.map((f) => {
            const selected = selectedFiles.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => onToggle(f.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition text-left",
                  selected
                    ? "border-accent/30 bg-accent/5"
                    : "border-slate-200 hover:bg-slate-50"
                )}
              >
                {selected
                  ? <CheckSquare size={15} className="text-accent shrink-0" />
                  : <Square size={15} className="text-slate-300 shrink-0" />
                }
                <FileIcon size={13} className={cn("shrink-0", FILE_ICON_CLASS[f.file_type] ?? "text-slate-400")} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {f.chunk_count} chunks · {fmtBytes(f.size_bytes)}
                  </p>
                </div>
              </button>
            );
          })}

          {processingFiles.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 pt-2">
                Indexing…
              </p>
              {processingFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50 opacity-60"
                >
                  <Loader2 size={13} className="text-slate-400 animate-spin shrink-0" />
                  <p className="text-xs text-slate-500 truncate">{f.name}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* sticky footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        {selectedFiles.length > 0
          ? <span className="font-medium text-primary">{selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} · {totalChunks} chunks</span>
          : "No files selected"
        }
      </div>
    </div>
  );
}

// ─── History table ────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  exam: "Exam",
  flashcards: "Flashcards",
  learning_path: "Learning path",
  slides: "Slides",
};
const TYPE_COLORS: Record<string, string> = {
  exam: "bg-accent/10 text-accent",
  flashcards: "bg-teal/10 text-teal",
  learning_path: "bg-purple-50 text-purple-600",
  slides: "bg-amber/10 text-amber",
};
const STATUS_COLORS: Record<string, string> = {
  ready: "bg-teal/10 text-teal",
  processing: "bg-slate-100 text-slate-500",
  error: "bg-destructive/10 text-destructive",
};

function GenerationHistory({ groupId }: { groupId: string }) {
  const { data: items, isLoading } = useGenerationHistory(groupId);

  return (
    <div className="mt-8">
      <h2 className="font-sora text-lg font-semibold text-primary mb-4">Generation history</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : !items?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          No generations yet. Select files and generate your first exam or flashcard set.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Type", "Title", "Files", "Status", "Created", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", TYPE_COLORS[item.type] ?? "bg-slate-100 text-slate-500")}>
          {TYPE_LABELS[item.type] ?? item.type}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">{item.title}</td>
      <td className="px-4 py-3 text-slate-500 tabular-nums">{item.file_count}</td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium", STATUS_COLORS[item.status] ?? "")}>
          {item.status === "processing" && <Loader2 size={10} className="animate-spin" />}
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
        {new Date(item.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        {item.status === "ready" ? (
          <Link
            href={item.result_url}
            className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline"
          >
            Open <ArrowRight size={11} />
          </Link>
        ) : item.status === "error" ? (
          <span className="text-xs text-destructive">Failed</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main page client ─────────────────────────────────────────────────────────

export function GeneratePageClient({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();

  const { data: groups } = useGroups();
  const group = groups?.find((g) => g.id === groupId);
  const myRole = group?.my_role ?? "student";
  const plan = group?.plan ?? "free";

  const { data: files = [], isLoading: filesLoading } = useGroupFilesForGenerate(groupId);

  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<CardKey | null>("exam");
  const [inFlight, setInFlight] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const readyFiles = files.filter((f) => f.status === "ready");

  // Redirect students once role is known
  useEffect(() => {
    if (group && !["owner", "teacher"].includes(myRole)) {
      router.replace(`/groups/${groupId}`);
    }
  }, [group, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFile = (id: string) =>
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const selectAll = () => setSelectedFiles(readyFiles.map((f) => f.id));
  const deselectAll = () => setSelectedFiles([]);

  const toggleCard = (card: CardKey) =>
    setExpandedCard((prev) => (prev === card ? null : card));

  const cardProps = (card: CardKey): CardProps => ({
    groupId,
    selectedFiles,
    allFiles: files,
    expanded: expandedCard === card,
    onToggle: () => toggleCard(card),
    inFlight,
    onStart: () => setInFlight(true),
    onEnd: () => setInFlight(false),
  });

  const fileSelectorProps = {
    files,
    isLoading: filesLoading,
    selectedFiles,
    onToggle: toggleFile,
    onSelectAll: selectAll,
    onDeselectAll: deselectAll,
    groupId,
  };

  return (
    <div className="space-y-2">
      <div>
        <h1 className="font-sora text-3xl font-bold text-primary">Generate content</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Select source files then generate exams, flashcards, learning paths, or slides.
        </p>
      </div>

      {/* Plan gate banner */}
      {plan === "free" && (
        <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">
            <span className="font-medium">Free plan:</span> 5 exams/month · limited flashcards.{" "}
            <Link href="/upgrade" className="text-accent hover:underline font-medium">
              Upgrade for unlimited generation →
            </Link>
          </p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col sm:flex-row gap-6 pt-2">
        {/* Left: file selector (desktop only) */}
        <div className="hidden sm:block w-72 xl:w-80 shrink-0">
          <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-4 flex flex-col" style={{ maxHeight: "calc(100vh - 7rem)" }}>
            <FileSelector {...fileSelectorProps} />
          </div>
        </div>

        {/* Right: generation cards */}
        <div className="flex-1 min-w-0 space-y-3">
          {readyFiles.length === 0 && !filesLoading ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">No ready files in this group</p>
              <p className="text-sm text-slate-500 mt-1 mb-4">
                Upload and index at least one file before generating content.
              </p>
              <Link
                href={`/groups/${groupId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
              >
                Go to Files
              </Link>
            </div>
          ) : (
            <>
              <ExamCard {...cardProps("exam")} />
              <FlashcardsCard {...cardProps("flashcards")} />
              <PathCard {...cardProps("path")} />
              <SlidesCard {...cardProps("slides")} />
            </>
          )}
        </div>
      </div>

      {/* History */}
      <GenerationHistory groupId={groupId} />

      {/* Mobile: floating file picker button */}
      <div className="fixed bottom-24 right-4 z-40 sm:hidden">
        <button
          onClick={() => setShowFilePicker(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white text-sm font-medium shadow-lg hover:bg-primary/90"
        >
          <Sparkles size={15} />
          Files ({selectedFiles.length})
        </button>
      </div>

      {/* Mobile: bottom sheet */}
      {showFilePicker && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilePicker(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl flex flex-col"
            style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <h3 className="font-sora font-semibold text-primary">Source files</h3>
              <button onClick={() => setShowFilePicker(false)}>
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <FileSelector {...fileSelectorProps} />
            </div>
            <div className="px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowFilePicker(false)}
                className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
