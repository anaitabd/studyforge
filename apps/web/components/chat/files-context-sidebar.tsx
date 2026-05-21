"use client";

import { FileText } from "lucide-react";
import { useFiles as useGroupFiles } from "@/lib/hooks/use-files";
import { FileStatusBadge } from "@/components/files/file-status-badge";

export function FilesContextSidebar({ groupId }: { groupId: string }) {
  const { data: files } = useGroupFiles(groupId);
  const ready = (files ?? []).filter((f) => f.status === "ready");
  const pending = (files ?? []).filter((f) => f.status !== "ready" && f.status !== "error");
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
        <FileText size={11} /> Files in context ({ready.length})
      </p>
      {(files ?? []).length === 0 ? (
        <p className="text-xs text-slate-400">No files yet.</p>
      ) : (
        <ul className="space-y-2">
          {ready.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <FileText size={12} className="text-teal shrink-0" />
              <span className="text-xs text-slate-600 truncate flex-1" title={f.name}>{f.name}</span>
            </li>
          ))}
          {pending.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <FileText size={12} className="text-slate-400 shrink-0" />
              <span className="text-xs text-slate-400 truncate flex-1" title={f.name}>{f.name}</span>
              <FileStatusBadge status={f.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
