"use client";

import { useState } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";

export function GenerateFlashcardsDialog({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(30);
  const [language, setLanguage] = useState("auto");

  const generate = useMutation({
    mutationFn: () => apiPost(`/api/v1/groups/${groupId}/flashcards/generate`, {
      title: title.trim() || `Set · ${new Date().toLocaleDateString()}`,
      max_cards: count,
      language,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flashcards", groupId] }); toast.success("Flashcards generated!"); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sora text-lg font-semibold text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-amber" /> Generate flashcards
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 4 Vocabulary" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Card count: {count}</label>
            <input type="range" min={10} max={100} step={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            type="button"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {generate.isPending && <Loader2 size={13} className="animate-spin" />}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
