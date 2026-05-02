"use client";

import { FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { useDeleteFile, type GroupFile } from "@/lib/hooks/use-files";
import { formatBytes, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const STATUS_CONFIG = {
  uploading: { label: "Uploading", icon: Loader2, color: "text-blue-500", spin: true },
  processing: { label: "Processing", icon: Loader2, color: "text-amber-500", spin: true },
  ready: { label: "Ready", icon: CheckCircle2, color: "text-emerald-500", spin: false },
  error: { label: "Error", icon: AlertCircle, color: "text-red-500", spin: false },
};

function StatusBadge({ status }: { status: GroupFile["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", cfg.color)}>
      <cfg.icon size={13} className={cfg.spin ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

export function FileList({ files, groupId }: { files: GroupFile[]; groupId: string }) {
  const { mutate: deleteFile } = useDeleteFile(groupId);

  if (files.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No files yet. Upload one above.</p>;
  }

  function handleDelete(file: GroupFile) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    deleteFile(file.id, {
      onSuccess: () => toast.success("File deleted"),
      onError: (err) => toast.error((err as Error).message),
    });
  }

  return (
    <ul className="divide-y divide-slate-100">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3 py-3 group">
          <FileText size={18} className="shrink-0 text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(file.size)} · {formatDate(file.created_at)}
            </p>
            {file.error_message && (
              <p className="text-xs text-red-400 mt-0.5">{file.error_message}</p>
            )}
          </div>
          <StatusBadge status={file.status} />
          <button
            onClick={() => handleDelete(file)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all ml-2"
            aria-label="Delete file"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
