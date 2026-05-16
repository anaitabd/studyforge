"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGlobalSearch } from "@/lib/hooks/use-search";

const TYPE_LABELS: Record<string, string> = {
  group: "Groupe",
  file: "Fichier",
  exam: "Examen",
  flashcard_set: "Flashcards",
};

function resultHref(item: { id: string; type: string; group_id?: string }): string {
  if (item.type === "group") return `/groups/${item.id}`;
  if (item.type === "file") return `/groups/${item.group_id}/files`;
  if (item.type === "exam") return `/groups/${item.group_id}/exams/${item.id}`;
  if (item.type === "flashcard_set") return `/groups/${item.group_id}/flashcards/${item.id}`;
  return "/dashboard";
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const allResults = data
    ? [
        ...data.results.groups,
        ...data.results.files,
        ...data.results.exams,
        ...data.results.flashcard_sets,
      ]
    : [];

  function navigate(item: (typeof allResults)[0]) {
    router.push(resultHref(item));
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:border-indigo-400 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Rechercher
        <kbd className="ml-1 hidden sm:inline rounded border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-xs font-mono text-gray-400">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher groupes, examens, fichiers…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          {isFetching && (
            <svg className="h-4 w-4 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </div>

        {allResults.length > 0 && (
          <ul className="max-h-80 overflow-y-auto py-2">
            {allResults.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <button
                  onClick={() => navigate(item)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {item.name ?? item.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && !isFetching && allResults.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Aucun résultat pour « {query} »</p>
        )}

        {query.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Tapez pour rechercher…</p>
        )}
      </div>
    </div>
  );
}
