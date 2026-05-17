"use client";

import { use, useState } from "react";
import { Network, Search, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Concept {
  id: string;
  name: string;
  subject: string | null;
  level: string | null;
  definition: string | null;
  formula: string | null;
  created_at: string;
}

function useConcepts(groupId: string) {
  return useQuery<{ concepts: Concept[]; total: number }>({
    queryKey: ["concepts", groupId],
    queryFn: () => apiGet(`/api/v1/groups/${groupId}/concepts`),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}

function ConceptCard({ concept }: { concept: Concept }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-primary">{concept.name}</h3>
            {concept.subject && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent">{concept.subject}</span>
            )}
            {concept.level && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">{concept.level}</span>
            )}
          </div>
          {!open && concept.definition && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{concept.definition}</p>
          )}
        </div>
        <span className={cn("text-slate-400 text-xs transition-transform shrink-0", open && "rotate-180")}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {concept.definition && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Définition</p>
              <div className="prose prose-sm max-w-none text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept.definition}</ReactMarkdown>
              </div>
            </div>
          )}
          {concept.formula && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Formule</p>
              <pre className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 overflow-x-auto font-mono text-slate-800 whitespace-pre-wrap">
                {concept.formula}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConceptsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data, isLoading } = useConcepts(groupId);
  const [q, setQ] = useState("");

  const concepts = (data?.concepts ?? []).filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.subject?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Network size={18} className="text-slate-400" />
          <p className="text-sm text-slate-500">{data?.total ?? 0} concept{(data?.total ?? 0) !== 1 ? "s" : ""} extraits des fichiers</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : concepts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Network className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-slate-500 text-sm">
            {q ? "Aucun concept ne correspond à cette recherche." : "Aucun concept extrait pour l'instant."}
          </p>
          {!q && <p className="text-xs text-slate-400 mt-1">Les concepts sont extraits automatiquement lors de l&apos;indexation des fichiers.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {concepts.map((c) => <ConceptCard key={c.id} concept={c} />)}
        </div>
      )}
    </div>
  );
}
