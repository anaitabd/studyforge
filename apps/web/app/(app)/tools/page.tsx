"use client";

import { useRef, useState } from "react";
import { ScanText, Lightbulb, Upload, Loader2, Copy, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// ─── OCR card ─────────────────────────────────────────────────────────────────

interface OcrResult {
  text: string;
  char_count: number;
  has_math: boolean;
  detected_language: string;
}

function OcrCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [copied, setCopied] = useState(false);

  const ocr = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<OcrResult>("/ocr/extract", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
      return res.data;
    },
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error((e as Error).message),
  });

  function handleFile(file: File) {
    setResult(null);
    ocr.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    toast.success("Texte copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
          <ScanText size={20} />
        </span>
        <div>
          <h2 className="font-sora font-semibold text-primary">Scanner mes notes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Extrait le texte d&apos;une photo de notes manuscrites ou d&apos;un document</p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-colors"
      >
        {ocr.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="text-accent animate-spin" />
            <p className="text-sm text-slate-500">Extraction en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-400" />
            <p className="text-sm text-slate-500">Déposer ou cliquer pour choisir une image</p>
            <p className="text-xs text-slate-400">JPEG, PNG ou WebP · max 15 Mo</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-xs text-slate-400">
              <span>{result.char_count} caractères</span>
              {result.has_math && <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">Formules détectées</span>}
              <span className="uppercase">{result.detected_language}</span>
            </div>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary">
              {copied ? <Check size={12} className="text-teal" /> : <Copy size={12} />}
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <pre className="text-sm bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-64 whitespace-pre-wrap font-sans text-slate-800">
            {result.text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Photo solver card ────────────────────────────────────────────────────────

interface SolveStep {
  step_number: number;
  action: string;
  calculation: string;
  explanation: string;
}

interface SolveResult {
  problem_restated: string;
  approach: string;
  steps: SolveStep[];
  final_answer: string;
  verification?: string;
  common_mistakes?: string[];
  related_concepts?: string[];
}

function SolverCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<SolveResult | null>(null);

  const solve = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<SolveResult>("/solve/photo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 90000,
      });
      return res.data;
    },
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error((e as Error).message),
  });

  function handleFile(file: File) {
    setResult(null);
    solve.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center text-amber">
          <Lightbulb size={20} />
        </span>
        <div>
          <h2 className="font-sora font-semibold text-primary">Résoudre un problème</h2>
          <p className="text-xs text-slate-500 mt-0.5">Photographie un exercice, obtiens la résolution étape par étape</p>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber/40 hover:bg-amber/5 transition-colors"
      >
        {solve.isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="text-amber animate-spin" />
            <p className="text-sm text-slate-500">Résolution en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-400" />
            <p className="text-sm text-slate-500">Photo d&apos;un problème à résoudre</p>
            <p className="text-xs text-slate-400">JPEG, PNG ou WebP · max 15 Mo</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>

      {result && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Problème</p>
            <p className="text-sm text-slate-800">{result.problem_restated}</p>
          </div>

          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Approche</p>
            <p className="text-sm text-slate-700">{result.approach}</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Étapes</p>
            {result.steps.map((step) => (
              <div key={step.step_number} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step.step_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{step.action}</p>
                  {step.calculation && (
                    <div className="prose prose-sm max-w-none mt-1 text-accent">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.calculation}</ReactMarkdown>
                    </div>
                  )}
                  {step.explanation && <p className="text-xs text-slate-500 mt-1">{step.explanation}</p>}
                </div>
              </div>
            ))}
          </div>

          {result.final_answer && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Réponse</p>
              <p className="text-sm font-semibold text-emerald-800">{result.final_answer}</p>
            </div>
          )}

          {result.common_mistakes && result.common_mistakes.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Erreurs fréquentes</p>
              <ul className="space-y-1">
                {result.common_mistakes.map((m, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="mt-0.5">•</span> {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="font-sora text-2xl font-bold text-primary">Outils IA</h1>
        <p className="text-sm text-slate-500 mt-1">Scanne tes notes ou résous un exercice en photo</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <OcrCard />
        <SolverCard />
      </div>
    </div>
  );
}
