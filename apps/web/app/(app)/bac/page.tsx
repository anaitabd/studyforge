"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Award, Clock, BarChart2, BookOpen, CheckCircle, ChevronRight,
  RefreshCw, Trophy,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  useBacMeta, useBacPapers, useBacStats, useStartBacPractice,
  type BacBranch, type BacSession, type BacPaper,
} from "@/lib/hooks/use-bac";
import { cn } from "@/lib/utils";

const BRANCH_LABELS: Record<BacBranch, string> = {
  SM: "Sciences Mathématiques",
  SE: "Sciences Expérimentales",
  SEco: "Sciences Économiques",
  SH: "Sciences Humaines",
  SAgro: "Sciences Agro-Alimentaires",
  SA: "Sciences Agronomiques",
  Lettres: "Lettres",
  Arts: "Arts Appliqués",
};

function scoreColor(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 16) return "text-teal";
  if (score >= 12) return "text-amber";
  return "text-destructive";
}

function scoreBg(score: number | null) {
  if (score === null) return "bg-slate-100 text-slate-400";
  if (score >= 16) return "bg-teal/10 text-teal";
  if (score >= 12) return "bg-amber/10 text-amber";
  return "bg-destructive/10 text-destructive";
}

export default function BacPage() {
  const router = useRouter();
  const { data: meta } = useBacMeta();
  const { data: stats } = useBacStats();
  const { mutate: startPractice, isPending: starting } = useStartBacPractice();

  const [branch, setBranch] = useState<BacBranch | "">("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [session, setSession] = useState<BacSession | "">("");

  const { data: papersData, isLoading: papersLoading } = useBacPapers({
    branch: branch || undefined,
    subject: subject || undefined,
    year: year || undefined,
    session: session || undefined,
  });

  const subjects = branch && meta ? (meta.subjects_by_branch[branch] ?? []) : [];
  const years = meta
    ? Array.from({ length: meta.year_range.max - meta.year_range.min + 1 }, (_, i) => meta.year_range.max - i)
    : [];

  const handleStart = (paperId: string) => {
    startPractice(paperId, {
      onSuccess: (data) => {
        router.push(`/bac/practice/${data.session_id}`);
      },
      onError: () => toast.error("Impossible de démarrer l'entraînement"),
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award size={24} className="text-accent" />
            <h1 className="font-sora text-3xl font-bold text-primary">Bac Prépa</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Exercez-vous sur les épreuves officielles du Baccalauréat marocain avec correction IA.
          </p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total_sessions > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Trophy size={16} className="text-accent" />}
            label="Moyenne générale"
            value={stats.overall_average !== null ? `${stats.overall_average}/20` : "—"}
            highlight={!!stats.overall_average && stats.overall_average >= 10}
          />
          <StatCard
            icon={<CheckCircle size={16} className="text-teal" />}
            label="Sessions terminées"
            value={String(stats.total_sessions)}
          />
          {Object.entries(stats.subject_averages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([subj, avg]) => (
              <StatCard
                key={subj}
                icon={<BookOpen size={16} className="text-amber" />}
                label={subj.length > 18 ? subj.slice(0, 18) + "…" : subj}
                value={`${avg}/20`}
                highlight={avg >= 10}
              />
            ))}
        </div>
      )}

      {/* Score history chart */}
      {stats && stats.score_history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-slate-700">Progression des scores</h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.score_history} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} tickLine={false} />
              <Tooltip
                formatter={(v) => [`${v}/20`, "Score"]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <ReferenceLine y={10} stroke="hsl(var(--destructive))" strokeDasharray="4 2" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--accent))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        {/* Branch tabs */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filière</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setBranch(""); setSubject(""); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition",
                !branch ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              Toutes
            </button>
            {(meta?.branches ?? []).map((b) => (
              <button
                key={b}
                onClick={() => { setBranch(b); setSubject(""); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition",
                  branch === b ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Subject + Year + Session row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Matière</label>
            <select
              className="input w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Toutes les matières</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Année</label>
            <select
              className="input w-full"
              value={year}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Toutes les années</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Session</label>
            <select
              className="input w-full"
              value={session}
              onChange={(e) => setSession(e.target.value as BacSession | "")}
            >
              <option value="">Normale + Rattrapage</option>
              <option value="normale">Session Normale</option>
              <option value="rattrapage">Session Rattrapage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Papers grid */}
      {papersLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : !papersData?.papers.length ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Award size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">
            Aucune épreuve disponible pour ces filtres.<br />
            Essayez de modifier la filière ou l'année.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{papersData.total} épreuve{papersData.total > 1 ? "s" : ""}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {papersData.papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onStart={() => handleStart(paper.id)}
                loading={starting}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("font-sora font-bold text-2xl", highlight ? "text-accent" : "text-primary")}>{value}</p>
    </div>
  );
}

function PaperCard({
  paper, onStart, loading,
}: {
  paper: BacPaper;
  onStart: () => void;
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-accent/50 hover:shadow-sm transition-all p-5 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider">
              {paper.branch}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium",
              paper.session === "rattrapage" ? "bg-amber/10 text-amber" : "bg-slate-100 text-slate-500"
            )}>
              {paper.session === "rattrapage" ? "Rattrapage" : "Normale"}
            </span>
          </div>
          <p className="font-sora font-semibold text-primary text-sm leading-tight">{paper.subject}</p>
          <p className="text-slate-400 text-xs mt-0.5">{paper.year} · {paper.region === "regionale" ? "Régionale" : "Nationale"}</p>
        </div>

        {paper.my_avg_score !== null && (
          <span className={cn("px-2.5 py-1 rounded-full text-sm font-bold shrink-0", scoreBg(paper.my_avg_score))}>
            {paper.my_avg_score}/20
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Clock size={12} />{paper.duration_minutes} min</span>
        <span className="flex items-center gap-1"><BookOpen size={12} />{paper.question_count} questions</span>
        {paper.my_attempt_count > 0 && (
          <span className="flex items-center gap-1 text-accent"><RefreshCw size={12} />{paper.my_attempt_count}×</span>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        disabled={loading}
        className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {paper.my_attempt_count > 0 ? (
          <><RefreshCw size={14} /> Recommencer</>
        ) : (
          <><Award size={14} /> Commencer l'épreuve</>
        )}
        <ChevronRight size={14} className="ltr:ml-auto rtl:mr-auto" />
      </button>
    </div>
  );
}
