"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#2563EB", "#8B5CF6", "#EC4899", "#0D9488"];
const EMOJIS = ["📚", "📖", "🧪", "🔬", "📐", "💻", "🎨", "🌍", "⚗️", "🎯"];

export function NewGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[4]);
  const [emoji, setEmoji] = useState("📚");

  const create = useMutation({
    mutationFn: () => apiPost<{ id: string }>("/api/v1/groups", { name: name.trim(), color, description: emoji }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created");
      setName(""); onClose();
      router.push(`/groups/${g.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sora text-lg font-semibold text-primary">New group</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="e.g. Advanced Mathematics"
              className="input"
              autoFocus
              required
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">{name.length}/60</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn("w-8 h-8 rounded-full transition-all", color === c && "ring-2 ring-offset-2 ring-slate-900")}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Emoji</label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn("w-9 h-9 rounded-lg text-lg transition-colors", emoji === e ? "bg-accent/10 ring-2 ring-accent" : "hover:bg-slate-100")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {create.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
