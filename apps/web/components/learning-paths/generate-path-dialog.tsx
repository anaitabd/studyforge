"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Sparkles, FileText } from "lucide-react";
import { useFiles as useGroupFiles } from "@/lib/hooks/use-files";
import { useGenerateLearningPath } from "@/lib/hooks/use-learning-paths";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export function GeneratePathDialog({
  groupId,
  open,
  onClose,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: files } = useGroupFiles(groupId);
  const ready = (files ?? []).filter((f: { status: string }) => f.status === "ready");
  const [title, setTitle] = useState("");
  const [moduleCount, setModuleCount] = useState(6);
  const [language, setLanguage] = useState("auto");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const generate = useGenerateLearningPath(groupId);

  if (!open) return null;

  function handleGenerate() {
    generate.mutate(
      {
        title: title.trim() || "Course learning path",
        module_count: moduleCount,
        language,
        file_ids: selectedIds.length > 0 ? selectedIds : undefined,
      },
      {
        onSuccess: (path) => {
          toast.success("Learning path created");
          onClose();
          router.push(`/groups/${groupId}/learning-paths/${path.id}`);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Generation failed";
          toast.error(msg);
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <h2 className="font-semibold text-slate-900">New learning path</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Java Foundations Path"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Modules ({moduleCount})
              </label>
              <input
                type="range"
                min={3}
                max={12}
                value={moduleCount}
                onChange={(e) => setModuleCount(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">
              Files <span className="text-slate-400">(leave empty to use all)</span>
            </p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {ready.length === 0 && (
                <p className="px-2 py-3 text-xs text-slate-400">
                  No ready files yet. Upload files to this group first.
                </p>
              )}
              {ready.map((f: { id: string; name: string }) => {
                const sel = selectedIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setSelectedIds((prev) =>
                        sel ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      sel
                        ? "bg-accent/10 text-accent"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <FileText size={12} />
                    <span className="flex-1 truncate">{f.name}</span>
                    {sel && <span className="text-[10px] font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generate.isPending || ready.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {generate.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
